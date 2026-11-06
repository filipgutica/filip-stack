# UX guidance probe scorer. Usage:
#   probe.py prepare <run> --arms <dir> --calibration <dir> [--review-attempts 5] [--build-attempts 3]
#       make one workspace per attempt, its prompt, the private ledger, and commands.sh
#   probe.py context <capture-dir>        list guidance markers in each captured request body
#   probe.py validate <run>               check every attempt trace for isolation; writes isolation.json
#   probe.py tally <run> --key <file>     score the review attempts; writes review-scores.json
#   probe.py selftest --key <file> --answers <dir>   tally fixed answers against their expected scores
#   probe.py gates <run> --repo <dir> --tools <dir>  run the gates and screenshots on each build
#   probe.py bundle <run> [--bundle-root <dir>]   write blind judge bundles, prompts, and the judge ledger;
#       bundles go under <dir>, default a new temporary folder, never inside <run>
#   probe.py score <run>                  read judge replies and apply the decision rule
# The calibration folder (review pages, key, self-test answers) stays outside the repository.
import hashlib, json, os, re, secrets, shutil, subprocess, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep __pycache__ out of the scorer folder
from prompts import BUILD, CODEX_ATTACHED, CRITERIA, JUDGE, REVIEW  # noqa: E402

FIXTURE = os.path.join(HERE, 'fixture', 'app')
ARMS = ['vanilla', 'base', 'head']
REVIEW_TASKS = ['R1', 'R2', 'R3']
PAIRINGS = ['base', 'vanilla']
SATURATED = 2.5  # a vanilla review mean at or above this leaves too little room for a 0.5 gain
MIN_GAIN = 0.5
JUDGES = {'opus': 'claude-opus-5-5', 'astra': 'gpt-6-astra', 'sol': 'gpt-6.1-sol'}
ATTEMPT_TOOLS = 'Read,Edit,Write,Glob,Grep'
JUDGE_TOOLS = 'Read,Glob,Grep'
STATES = ['s1-empty', 's2-validation', 's3-server-error', 's4-success', 's5-populated']
VIEWS = ['1280-light', '375-light', '375-dark']
# Text that would show user or arm guidance in a vanilla context. Checked in captured requests.
MARKERS = ['interface-design', 'design-language', 'DESIGN.md', 'ux-laws', 'UX law', 'frontend-design', 'Field Guide',
           'field-guide', 'ctx7', 'Filip', 'filip-stack', 'Kongponents', 'Konnect', 'humanizer', 'roles.md',
           'CODING_STANDARDS', 'Output Style', 'WCAG', "Fitts", "Hick", 'skills_instructions']
# Words in a build's own files that could show which guidance it followed. Counted before stripping.
ARM_MARKERS = ['interface-design', 'ux-laws', 'frontend-design', 'UX law', "Fitts", "Hick", "Jakob", 'Miller',
               'Doherty', 'Tesler', 'Postel', 'Von Restorff', 'Gestalt', 'WCAG', 'skill']


def load(path):
    with open(path) as f:
        return json.load(f)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)


def opt(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def rid():
    return secrets.token_hex(4)


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


# ---------- prepare ----------

def prepare(run):
    arms, calib = opt('--arms'), opt('--calibration')
    review_n, build_n = int(opt('--review-attempts', 5)), int(opt('--build-attempts', 3))
    os.makedirs(f'{run}/prompts', exist_ok=True)
    jobs = [(t, n) for t in REVIEW_TASKS for n in range(1, review_n + 1)] + [('B1', n) for n in range(1, build_n + 1)]
    ledger = []
    for task, n in jobs:
        # The arms of one task and attempt number run next to each other, in random order, to spread drift.
        for arm in secrets.SystemRandom().sample(ARMS, len(ARMS)):
            aid, guide = rid(), f'g-{rid()}'
            ws = os.path.realpath(f'{run}/w/{aid}')
            shutil.copytree(os.path.join(arms, arm), os.path.join(ws, guide))
            if task == 'B1':
                shutil.copytree(FIXTURE, os.path.join(ws, 'app'))
                prompt = BUILD.format(guide=guide)
            else:
                shutil.copytree(os.path.join(calib, 'review', task, 'planted'), os.path.join(ws, 'task'))
                prompt = REVIEW.format(guide=guide)
            with open(f'{run}/prompts/{aid}.txt', 'w') as f:
                f.write(prompt + '\n')
            ledger.append({'id': aid, 'task': task, 'attempt': n, 'arm': arm, 'workspace': ws, 'guide': guide})
    dump(f'{run}/ledger.json', ledger)
    run_abs = os.path.realpath(run)
    with open(f'{run}/commands.sh', 'w') as f:
        for a in ledger:
            f.write(f"{HERE}/run-claude.sh {a['workspace']} {run_abs}/prompts/{a['id']}.txt {run_abs}/traces/{a['id']}.jsonl {ATTEMPT_TOOLS}\n")
    os.makedirs(f'{run}/traces', exist_ok=True)
    print(f'{len(ledger)} attempts')


# ---------- context and isolation ----------

def context(capture):
    out = {}
    for name in sorted(os.listdir(capture)):
        rec = load(os.path.join(capture, name))
        if '/v1/messages' not in rec['url'] and '/v1/responses' not in rec['url']:
            continue
        body = rec['body']
        out[name] = {'chars': len(body), 'markers': {m: body.count(m) for m in MARKERS if m in body},
                     'auth_header': any(h in rec['headerNames'] for h in ('authorization', 'x-api-key'))}
    print(json.dumps(out, indent=1))
    return out


def events(path):
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith('{'):
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


def inside(path, root):
    real = os.path.realpath(path if os.path.isabs(path) else os.path.join(root, path))
    return real == root or real.startswith(root + os.sep)


REFUSED = '--restricted confines the file tools'


def outside_paths(name, inp, root):
    paths = [inp[k] for k in ('file_path', 'path', 'notebook_path') if k in inp and not inside(inp[k], root)]
    pattern = inp.get('pattern', '')
    if name == 'Glob' and os.path.isabs(pattern) and not inside(pattern.split('*')[0] or '/', root):
        paths.append(pattern)
    return paths


def check_trace(path, root, tools, guide=None):
    """Isolation problems in one stream-json trace, the outside calls --restricted refused, and how many
    guidance files it read. A refused outside call shows isolation working, so it is a diagnostic; an
    outside call that succeeded is a breach."""
    problems, refused, guide_reads, result = [], [], set(), None
    allowed = set(tools.split(','))
    init = next((e for e in events(path) if e.get('type') == 'system' and e.get('subtype') == 'init'), None)
    if not init:
        return ['no init event'], [], 0, None
    if set(init.get('tools', [])) != allowed:
        problems.append(f"tools {sorted(init.get('tools', []))}")
    for field in ('mcp_servers', 'skills', 'slash_commands'):
        if init.get(field):
            problems.append(f'{field} loaded: {init[field]}')
    for p in init.get('plugins', []):
        if not str(p.get('source', '')).endswith('@builtin'):
            problems.append(f"plugin {p.get('source')}")
    if init.get('model') != 'claude-opus-5-5':
        problems.append(f"model {init.get('model')}")
    if os.path.realpath(init.get('cwd', '')) != root:
        problems.append(f"cwd {init.get('cwd')}")
    calls, outcomes = [], {}
    for e in events(path):
        if e.get('type') == 'result':
            result = e
        for c in (e.get('message') or {}).get('content', []) if e.get('type') in ('assistant', 'user') else []:
            if not isinstance(c, dict):
                continue
            if c.get('type') == 'tool_use':
                calls.append(c)
            elif c.get('type') == 'tool_result':
                text = c.get('content') if isinstance(c.get('content'), str) else json.dumps(c.get('content'))
                outcomes[c.get('tool_use_id')] = (str(c.get('is_error')).lower() == 'true', text)
    for c in calls:
        if c['name'] not in allowed:
            problems.append(f"tool {c['name']}")
        inp = c.get('input', {})
        for out in outside_paths(c['name'], inp, root):
            failed, text = outcomes.get(c.get('id'), (False, ''))
            if failed and REFUSED in text:
                refused.append(f"{c['name']} {out}")
            else:
                problems.append(f"{c['name']} outside workspace: {out}")
        if guide and c['name'] == 'Read' and inside(inp.get('file_path', ''), os.path.join(root, guide)):
            guide_reads.add(os.path.realpath(inp['file_path']))
    if not result:
        problems.append('no result event')
    elif result.get('is_error'):
        problems.append(f"result error: {str(result.get('result'))[:80]}")
    return problems, refused, len(guide_reads), result


def check_codex_trace(path, bundle):
    """Problems in a Codex --json trace. Its inputs are attached or inline, so it needs no command;
    a command that reaches outside the bundle (an absolute path elsewhere, or ..) is a breach."""
    problems, commands, bundle = [], [], os.path.realpath(bundle)
    system = ('/bin/', '/usr/', '/opt/', '/dev/', '/System/')  # shells and tools a command names, not data
    for e in events(path):
        item = e.get('item') or {}
        if e.get('type') == 'item.completed' and item.get('type') not in (None, 'agent_message', 'reasoning'):
            cmd = str(item.get('command') or item.get('path') or item)
            commands.append(cmd[:120])
            paths = [p for p in re.findall(r'(?<![\w.])/[\w./-]+', cmd) if not p.startswith(system)]
            reaches_out = '..' in cmd or any(not inside(p, bundle) for p in paths)
            if reaches_out:
                problems.append(f"{item.get('type')} outside bundle: {cmd[:120]}")
    return problems, commands


def validate(run):
    ledger = load(f'{run}/ledger.json')
    report = {}
    for a in ledger:
        path = f"{run}/traces/{a['id']}.jsonl"
        if not os.path.exists(path):
            report[a['id']] = {'problems': ['missing trace']}
            continue
        problems, refused, reads, _ = check_trace(path, a['workspace'], ATTEMPT_TOOLS, a['guide'])
        report[a['id']] = {'arm': a['arm'], 'problems': problems, 'refused_outside': refused, 'guide_files_read': reads}
    for j in (load(f'{run}/judge-ledger.json') if os.path.exists(f'{run}/judge-ledger.json') else []):
        path = f"{run}/judges/{j['pair']}-opus.jsonl"
        if os.path.exists(path):
            problems, refused, _, _ = check_trace(path, j['bundle'], JUDGE_TOOLS)
            report[f"{j['pair']}-opus"] = {'problems': problems, 'refused_outside': refused}
        for judge in ('astra', 'sol'):
            path = f"{run}/judges/{j['pair']}-{judge}.jsonl"
            if os.path.exists(path):
                problems, commands = check_codex_trace(path, j['bundle'])
                report[f"{j['pair']}-{judge}"] = {'problems': problems, 'commands': commands}
    dump(f'{run}/isolation.json', report)
    bad = {k: v['problems'] for k, v in report.items() if v['problems']}
    refused_by_arm = {arm: sum(len(v.get('refused_outside', [])) for v in report.values() if v.get('arm') == arm) for arm in ARMS}
    print(json.dumps({'checked': len(report), 'with_problems': bad, 'refused_outside_by_arm': refused_by_arm}, indent=1))
    return bad


# ---------- review tally ----------

def plain(line):
    """A reply line without Markdown emphasis, code marks, list markers, quote marks, or a heading mark."""
    line = re.sub(r'[*`_]', '', line)
    return re.sub(r'^(?:\s*(?:>|#+|[-+]|\d+[.)])(?=\s))+', '', line).strip()


def findings(text, cap):
    rows = [plain(l) for l in (text or '').splitlines() if not l.strip().startswith('```')]
    return [r for r in rows if re.match(r'FINDING\b', r, re.I)][:cap]


def unparsed(text):
    """A review reply that is neither NONE nor at least one FINDING line counts as missing."""
    return not findings(text, 1) and not re.fullmatch(r'\W*none\W*', text or '', re.I)


def matches(line, entry):
    hit = lambda pats: any(re.search(p, line, re.I) for p in pats)
    return hit(entry['where']) and hit(entry['what'])


def tally(text, page, cap):
    found, false, dup, unmatched = [], [], 0, 0
    for line in findings(text, cap):
        d = next((d for d in page['defects'] if d['id'] not in found and matches(line, d)), None)
        if d:
            found.append(d['id'])
        elif any(matches(line, d) for d in page['defects']):
            dup += 1
        elif (x := next((x for x in page['decoys'] if matches(line, x)), None)):
            false.append(x['id'])
        else:
            unmatched += 1
    return {'found': found, 'false': false, 'duplicates': dup, 'unmatched': unmatched, 'score': len(found) - len(false)}


def score_reviews(run, key):
    k = load(key)
    rows = []
    for a in load(f'{run}/ledger.json'):
        if a['task'] == 'B1':
            continue
        path = f"{run}/traces/{a['id']}.jsonl"
        result = next((e for e in events(path) if e.get('type') == 'result'), None) if os.path.exists(path) else None
        if not result or result.get('is_error'):
            rows.append({**a, 'missing': True})
            continue
        text, page = result.get('result', ''), k['pages'][a['task']]
        if unparsed(text):
            rows.append({**a, 'missing': True, 'unparsed': True})
            continue
        # Diagnostics, not in the rule: how many findings the reply listed, and its tally at a cap of 5.
        rows.append({**a, **tally(text, page, k['max_findings']), 'findings': len(findings(text, 10 ** 6)),
                     'score_cap5': tally(text, page, 5)['score']})
    by_arm = {}
    for arm in ARMS:
        done = [r for r in rows if r['arm'] == arm and not r.get('missing')]
        defects = [d['id'] for p in k['pages'].values() for d in p['defects']]
        by_arm[arm] = {
            'attempts': len(done),
            'mean_score': round(sum(r['score'] for r in done) / len(done), 3) if done else None,
            'mean_score_cap5': round(sum(r['score_cap5'] for r in done) / len(done), 3) if done else None,
            'mean_findings': round(sum(r['findings'] for r in done) / len(done), 2) if done else None,
            'false': sum(len(r['false']) for r in done), 'unmatched': sum(r['unmatched'] for r in done),
            'per_defect': {d: sum(d in r['found'] for r in done) for d in defects},
        }
    stop = [r['id'] for r in rows if r.get('unparsed')]
    dump(f'{run}/review-scores.json', {'attempts': rows, 'by_arm': by_arm, 'unparsed': stop})
    print(json.dumps({'by_arm': by_arm, 'unparsed': stop}, indent=1))
    return by_arm


def selftest():
    key, answers = load(opt('--key')), opt('--answers')
    expected = load(os.path.join(answers, 'expected.json'))
    ok = True
    for name, want in expected.items():
        with open(os.path.join(answers, f'{name}.txt')) as f:
            text = f.read()
        if want.get('unparsed'):
            passed = unparsed(text)
            print(f"{'pass' if passed else 'FAIL'} {name}: unparsed {unparsed(text)} (want True)")
        else:
            got = tally(text, key['pages'][name.split('-')[0]], key['max_findings'])
            passed = not unparsed(text) and got['score'] == want['score'] and len(got['false']) == want['false']
            print(f"{'pass' if passed else 'FAIL'} {name}: score {got['score']} (want {want['score']}), false {len(got['false'])} (want {want['false']}), found {got['found']}")
        ok &= passed
    for name, text, want in JUDGE_SAMPLES:
        got = parse_judge(text)
        passed = all(got[k] == v for k, v in want.items())
        ok &= passed
        print(f"{'pass' if passed else 'FAIL'} judge {name}: " + ', '.join(f'{k} {got[k]!r}' for k in want))
    sys.exit(0 if ok else 1)


# Judge replies in plain and Markdown forms, with the fields each must parse to.
_PLAIN = """C1 Task: A - x
C2 States: B - x
C3 Access: SAME - x
C4 Fit: A - x
OVERALL: A - x
NEXT: x
SCORE s1-empty: A 8 - x | B 6 - y
SCORE s2-validation: A 7 - x | B 6 - y
SCORE s3-server-error: A 7 - x | B 5 - y
SCORE s4-success: A 9 - x | B 6 - y
SCORE s5-populated: A 8 - x | B 7 - y
UNREAD: none"""
_MARKDOWN = '\n'.join(['**Judgment**', ''] + [f'- **{l.split(":")[0]}:**{l[len(l.split(":")[0]) + 1:]}' if ':' in l else l for l in _PLAIN.splitlines()])
JUDGE_SAMPLES = [
    ('plain', _PLAIN, {'overall': 'A', 'C2': 'B', 'C3': 'SAME', 'complete': True}),
    ('markdown', _MARKDOWN, {'overall': 'A', 'C2': 'B', 'complete': True}),
    ('fenced', '```\n' + _PLAIN + '\n```', {'overall': 'A', 'complete': True}),
    ('unread', _PLAIN.replace('UNREAD: none', 'UNREAD: A/s1-empty-375-dark.png'), {'complete': False}),
    ('no overall', _PLAIN.replace('OVERALL: A - x', ''), {'complete': False}),
]


# ---------- gates and screenshots ----------

def node(args, out):
    with open(out, 'w') as f:
        p = subprocess.run(['node', *args], stdout=f, stderr=subprocess.STDOUT)
    with open(out) as f:
        lines = [l for l in f.read().splitlines() if l.strip()]
    return {'exit': p.returncode, 'last': lines[-1] if lines else ''}


def gates(run):
    repo, tools = opt('--repo'), opt('--tools')
    scripts = os.path.join(repo, 'skills', 'interface-design', 'scripts')
    tokens = os.path.join(FIXTURE, 'tokens.css')  # the frozen tokens, even if a build edits its own copy
    results = {}
    for i, a in enumerate(b for b in load(f'{run}/ledger.json') if b['task'] == 'B1'):
        port, out, app = 47900 + i, os.path.realpath(f"{run}/gates/{a['id']}"), os.path.join(a['workspace'], 'app')
        os.makedirs(out, exist_ok=True)
        server = subprocess.Popen(['node', f'{HERE}/serve.mjs', app, str(port)])
        time.sleep(1)
        url = f'http://127.0.0.1:{port}/'
        try:
            check = node([f'{scripts}/ui-check.mjs', '--url', f'{url}?keys=0', '--url', f'{url}?keys=3', '--widths', '320,375,1280',
                          '--themes', 'light,dark', '--tokens', tokens, '--project', tools, '--out', f'{out}/check'], f'{out}/ui-check.log')
            modes = node([f'{scripts}/ui-modes.mjs', '--url', f'{url}?keys=0', '--tasks', f'{HERE}/ux-tasks.mjs',
                          '--project', tools, '--out', f'{out}/modes'], f'{out}/ui-modes.log')
            shots = node([f'{HERE}/capture-states.mjs', '--url', url, '--out', f'{out}/shots', '--project', tools], f'{out}/capture.log')
        finally:
            server.terminate()
        changed = [f for f in sorted(os.listdir(FIXTURE)) if f != 'index.html' and os.path.exists(os.path.join(app, f))
                   and sha256(os.path.join(app, f)) != sha256(os.path.join(FIXTURE, f))]
        results[a['id']] = {'ui_check': check, 'ui_modes': modes, 'states': shots['last'],
                            'pass': check['exit'] == 0 and modes['exit'] == 0, 'fixture_files_changed': changed}
    dump(f'{run}/gates.json', results)
    print(json.dumps(results, indent=1))


# ---------- judge bundles ----------

def strip_comments(name, text):
    if name.endswith('.html'):
        text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    if name.endswith(('.css', '.js', '.mjs', '.html')):
        text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    if name.endswith(('.js', '.mjs', '.html')):
        text = re.sub(r'(?m)^\s*//.*\n', '', text)
    return text


def app_files(app):
    out = {}
    for root, _, files in os.walk(app):
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), app)
            with open(os.path.join(root, f), errors='replace') as fh:
                out[rel] = fh.read()
    return out


def marker_counts(app):
    fixture = app_files(FIXTURE)
    counts = {}
    for rel, text in app_files(app).items():
        if fixture.get(rel) == text:
            continue
        for m in ARM_MARKERS:
            if (n := len(re.findall(re.escape(m), text, re.I))):
                counts[f'{rel}:{m}'] = n
    return counts


def bundle(run):
    ledger = [a for a in load(f'{run}/ledger.json') if a['task'] == 'B1']
    by = {(a['attempt'], a['arm']): a for a in ledger}
    pairs, markers = [], {a['id']: marker_counts(os.path.join(a['workspace'], 'app')) for a in ledger}
    # hill-climb keeps each bundle away from the work directory, so a judge cannot reach the ledgers.
    bundle_root = os.path.realpath(opt('--bundle-root') or tempfile.mkdtemp(prefix='b-'))
    if inside(bundle_root, os.path.realpath(run)):
        sys.exit('--bundle-root must be outside the run folder')
    for (n, arm), head in sorted(by.items()):
        if arm != 'head':
            continue
        for i, other in enumerate(PAIRINGS):
            o = by.get((n, other))
            if not o:
                continue
            # Balanced order: head is A in half of the pairs.
            a, b = (head, o) if (n + i) % 2 == 0 else (o, head)
            pair = rid()
            root = os.path.join(bundle_root, pair)
            os.makedirs(f'{root}/tasks')
            with open(f'{root}/criteria.md', 'w') as f:
                f.write(CRITERIA)
            for name in ('BRIEF.md', 'DESIGN.md', 'tokens.css', 'app.css'):
                shutil.copy(os.path.join(FIXTURE, name), f'{root}/tasks/{name}')
            images = []
            for side, build in (('A', a), ('B', b)):
                os.makedirs(f'{root}/{side}')
            for state in STATES:
                for view in VIEWS:
                    name = f'{state}-{view}.png'
                    pa, pb = (f"{run}/gates/{x['id']}/shots/{name}" for x in (a, b))
                    if os.path.exists(pa) and os.path.exists(pb) and sha256(pa) == sha256(pb):
                        continue
                    for side, src in (('A', pa), ('B', pb)):
                        if os.path.exists(src):
                            shutil.copy(src, f'{root}/{side}/{name}')
                            images.append(f'{side}/{name}')
            fa, fb = (app_files(os.path.join(x['workspace'], 'app')) for x in (a, b))
            texts = {}
            for rel in sorted(set(fa) | set(fb)):
                ta, tb = (strip_comments(rel, x[rel]) if rel in x else None for x in (fa, fb))
                if ta == tb:
                    continue
                for side, t in (('A', ta), ('B', tb)):
                    if t is not None:
                        dest = f'{root}/{side}-files/{rel}'
                        os.makedirs(os.path.dirname(dest), exist_ok=True)
                        with open(dest, 'w') as f:
                            f.write(t)
                        texts[f'{side}-files/{rel}'] = t
            brief = JUDGE.format(bundle=root)
            if not images:
                brief += '\nNo screenshot differs between A and B.'
            with open(f'{run}/prompts/judge-{pair}-opus.txt', 'w') as f:
                f.write(brief + '\n')
            inline = {'criteria.md': CRITERIA, **{f'tasks/{n}': open(f'{root}/tasks/{n}').read() for n in sorted(os.listdir(f'{root}/tasks'))}, **texts}
            files = ''.join(f'\n<<<FILE {rel}\n{t}\nFILE {rel}>>>\n' for rel, t in inline.items())
            with open(f'{run}/prompts/judge-{pair}-codex.txt', 'w') as f:
                f.write(brief + CODEX_ATTACHED.format(images=', '.join(images) or 'none', files=files) + '\n')
            # Marker words left after stripping comments, such as in a trailing // comment or in page copy.
            residual = {rel: [m for m in ARM_MARKERS if m.lower() in t.lower()] for rel, t in texts.items()}
            pairs.append({'pair': pair, 'attempt': n, 'pairing': f'head-vs-{other}', 'A': a['arm'], 'B': b['arm'],
                          'A_id': a['id'], 'B_id': b['id'], 'bundle': root, 'images': [f'{root}/{x}' for x in images],
                          'residual_markers': {k: v for k, v in residual.items() if v}})
    dump(f'{run}/judge-ledger.json', pairs)
    dump(f'{run}/markers.json', markers)
    run_abs = os.path.realpath(run)
    with open(f'{run}/judge-commands.sh', 'w') as f:
        for p in pairs:
            f.write(f"{HERE}/run-claude.sh {p['bundle']} {run_abs}/prompts/judge-{p['pair']}-opus.txt {run_abs}/judges/{p['pair']}-opus.jsonl {JUDGE_TOOLS}\n")
            for j in ('astra', 'sol'):
                f.write(f"{HERE}/run-codex-judge.sh {p['bundle']} {run_abs}/prompts/judge-{p['pair']}-codex.txt {run_abs}/judges/{p['pair']}-{j}.jsonl "
                        f"{JUDGES[j]} {run_abs}/judges/{p['pair']}-{j}.txt {' '.join(p['images'])}\n")
    os.makedirs(f'{run}/judges', exist_ok=True)
    print(f'{len(pairs)} pairs; marker hits: {sum(len(v) for v in markers.values())}')


# ---------- judge replies and decision ----------

def parse_judge(text):
    text = '\n'.join(plain(l) for l in (text or '').splitlines() if not l.strip().startswith('```'))
    vote = lambda label: (m.group(1).upper() if (m := re.search(rf'^\s*{label}[^:]*:\s*(A|B|SAME)\b', text, re.I | re.M)) else None)
    scores = {}
    for m in re.finditer(r'^\s*SCORE\s+(s\d[\w-]*)\s*:\s*A\s+(\d+)[^|]*\|\s*B\s+(\d+)', text, re.I | re.M):
        scores[m.group(1).lower()] = {'A': int(m.group(2)), 'B': int(m.group(3))}
    unread = re.search(r'^\s*UNREAD:\s*(.*)$', text, re.I | re.M)
    out = {'overall': vote('OVERALL'), **{f'C{i}': vote(f'C{i}') for i in range(1, 5)}, 'scores': scores,
           'unread': unread.group(1).strip() if unread else None}
    out['complete'] = out['overall'] is not None and out['unread'] is not None and out['unread'].lower() in ('none', 'none.', '')
    return out


def judge_text(run, pair, judge):
    if judge == 'opus':
        path = f'{run}/judges/{pair}-opus.jsonl'
        r = next((e for e in events(path) if e.get('type') == 'result'), None) if os.path.exists(path) else None
        return r.get('result') if r and not r.get('is_error') else None
    path = f'{run}/judges/{pair}-{judge}.txt'
    return open(path).read() if os.path.exists(path) else None


def score(run):
    review = load(f'{run}/review-scores.json')['by_arm']
    gates_ = load(f'{run}/gates.json')
    ledger = load(f'{run}/ledger.json')
    votes = []
    for p in load(f'{run}/judge-ledger.json'):
        for j in JUDGES:
            text = judge_text(run, p['pair'], j)
            if not text:
                continue
            r = parse_judge(text)
            if not r['complete']:
                continue
            arm = lambda v: p[v] if v in ('A', 'B') else 'SAME'
            votes.append({'pair': p['pair'], 'attempt': p['attempt'], 'pairing': p['pairing'], 'judge': j,
                          'overall': arm(r['overall']), **{c: arm(r[c]) if r[c] else None for c in ('C1', 'C2', 'C3', 'C4')},
                          'scores': {s: {p['A']: v['A'], p['B']: v['B']} for s, v in r['scores'].items()}})
    gate_pass = {arm: sum(gates_[a['id']]['pass'] for a in ledger if a['task'] == 'B1' and a['arm'] == arm and a['id'] in gates_) for arm in ARMS}
    saturated = review['vanilla']['mean_score'] is not None and review['vanilla']['mean_score'] >= SATURATED
    out = {'review': review, 'review_saturated': saturated, 'gate_pass': gate_pass, 'pairings': {}}
    for other in PAIRINGS:
        vs = [v for v in votes if v['pairing'] == f'head-vs-{other}']
        pair_counts = {}
        for v in vs:
            pair_counts[v['pair']] = pair_counts.get(v['pair'], 0) + 1
        valid = [v for v in vs if pair_counts[v['pair']] >= 2]  # a pair with fewer than two completed judges is void
        overall = [v['overall'] for v in valid]
        heads, others = overall.count('head'), overall.count(other)
        gain = round(review['head']['mean_score'] - review[other]['mean_score'], 3) if review['head']['mean_score'] is not None and review[other]['mean_score'] is not None else None
        out['pairings'][other] = {
            'review_gain': gain, 'review_part': None if saturated else (gain is not None and gain >= MIN_GAIN),
            'gate_part': gate_pass['head'] >= gate_pass[other],
            'votes': {'head': heads, other: others, 'SAME': overall.count('SAME'), 'completed': len(overall)},
            'judge_part': heads * 2 > len(overall) and len(overall) > 0,
            'by_judge': {j: [v['overall'] for v in valid if v['judge'] == j] for j in JUDGES},
            # hill-climb asks the report to say when a majority rests on two judges from one provider.
            'head_votes_by_provider': {'openai': sum(v['overall'] == 'head' for v in valid if v['judge'] != 'opus'),
                                       'anthropic': sum(v['overall'] == 'head' for v in valid if v['judge'] == 'opus')},
            'scorecard_mean': {arm: {s: mean([v['scores'][s][arm] for v in valid if s in v['scores'] and arm in v['scores'][s]]) for s in STATES} for arm in ('head', other)},
        }
    expected_pairs = len([a for a in ledger if a['task'] == 'B1' and a['arm'] == 'head']) * len(PAIRINGS)
    void = expected_pairs - len({v['pair'] for v in votes if sum(1 for w in votes if w['pair'] == v['pair']) >= 2})
    # A saturated review part is left out of the rule and reported as uninformative, not as failed.
    parts = [out['pairings'][o][k] for o in PAIRINGS for k in ('review_part', 'gate_part', 'judge_part') if out['pairings'][o][k] is not None]
    out['void_pairs'] = void
    expected_reviews = len([a for a in ledger if a['task'] != 'B1' and a['arm'] == 'head'])
    short = [arm for arm in ARMS if review[arm]['attempts'] * 3 < expected_reviews * 2]  # under two thirds scored
    out['review_arms_short'] = short
    undecidable = void * 3 > expected_pairs or bool(short)
    verdict = 'not decidable' if undecidable else ('supported' if all(parts) else 'not supported')
    out['verdict'] = verdict + ('; review part uninformative (vanilla saturated)' if saturated and verdict != 'not decidable' else '')
    dump(f'{run}/scores.json', {**out, 'votes': votes})
    print(json.dumps(out, indent=1))


def mean(values):
    return round(sum(values) / len(values), 2) if values else None


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'selftest':
        selftest()
    elif cmd == 'context':
        context(sys.argv[2])
    elif cmd == 'tally':
        score_reviews(sys.argv[2], opt('--key'))
    else:
        {'prepare': prepare, 'validate': validate, 'gates': gates, 'bundle': bundle, 'score': score}[cmd](sys.argv[2])

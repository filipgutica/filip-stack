# Writing-guidance climb scorer. Usage (run from the repository root):
#   climb.py brief-prompt <run> <id:type>...       write the brief-writer prompt
#   climb.py freeze-briefs <run>                   check the reply and write <run>/briefs.json
#   climb.py arm <ref> <prose-file|-> <out>        one guidance file: the technical-writing skill,
#                                                  its references, and two host sections at <ref>,
#                                                  with technical-prose.md taken from <prose-file>
#   climb.py builds <run> <version> <arm|-> <n>    n build prompts per brief; "-" is no guidance
#   climb.py reads <run>                           a reader prompt for each collected build
#   climb.py coder <run> <version>...              one error-analysis prompt per brief
#   climb.py collect <run>                         check replies and copy usable ones into the run
#   climb.py pending <run> [prefix]                dispatch lines for calls with no usable reply
#   climb.py score <run> <version>                 per-task table; the score is the last line
# Every prompt and every reply sits alone in its own random folder under $CLIMB_TMP, so no
# path a call sees names the run or the version. Only <run>/ledger.json maps builds to versions.
import json, os, re, secrets, shutil, subprocess, sys
from prompts import BRIEF_WRITER, BUILD, READER, CODER, TASK, reader_tasks, reader_answers, yes_no

TYPE_LABEL = {'tutorial': 'tutorial', 'how-to': 'how-to guide', 'reference': 'reference', 'explanation': 'explanation'}
# Score per task: 0 when the answer fails its key. A pass earns 1 - DEPTH_WEIGHT * min(depth / cap, 1), where
# cap is the brief's word limit, so a pass is always worth more than any depth difference between two passes.
DEPTH_WEIGHT = 0.4
REFUSAL = re.compile(r"\b(i can(no|')t|i am unable|i'm unable|i was unable|i could not|i couldn't)\b", re.I)


def load(path):
    with open(path) as f:
        return json.load(f)


def dump(path, data):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)


def reply_json(path):
    return json.loads(re.search(r'\{[\s\S]*\}', open(path).read()).group(0))


def words(text):
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", text))


def blocks(md):
    """Split a Markdown page into blocks: headings, paragraphs, list items, table rows, and code."""
    out, cur, fence = [], [], False
    flush = lambda: (out.append('\n'.join(cur).strip()), cur.clear()) if ''.join(cur).strip() else cur.clear()
    for line in md.strip().split('\n'):
        if line.lstrip().startswith('```'):
            if fence:
                cur.append(line); flush(); fence = False
            else:
                flush(); cur.append(line); fence = True
            continue
        if fence:
            cur.append(line); continue
        s = line.strip()
        if not s:
            flush()
        elif s.startswith('#') or s.startswith('|'):
            flush(); cur.append(line); flush()
        elif re.match(r'([-*+]|\d+[.)])\s', s):
            flush(); cur.append(line)
        else:
            cur.append(line)
    flush()
    return out


def norm(text):
    text = text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    text = text.replace('–', '-').replace('—', '-')
    text = re.sub(r'[*_`#>|]', ' ', text.lower())
    return re.sub(r'\s+', ' ', text).strip()


def depth_of(passage, md):
    """Words from the top of the page through the end of the first block holding the passage,
    or None when the passage is not on the page. A passage may span adjacent blocks."""
    q = norm(passage).strip(' ."\'')
    if not q:
        return None
    bs = blocks(md)
    joined, ends, pos, total = '', [], 0, 0
    for b in bs:
        nb = norm(b)
        joined += nb + ' '
        total += words(b)
        ends.append((len(joined), total))
    at = joined.find(q)
    if at < 0:
        return None
    end = at + len(q)
    return next(w for e, w in ends if e >= end)


def has(a, item):
    """An item is a string or a list of alternatives, any one of which counts."""
    return any(w.lower() in a for w in ([item] if isinstance(item, str) else item))


def grade(answer, rule):
    a = answer.lower().strip()
    if 'prefix' in rule:
        return re.match(rf"{re.escape(rule['prefix'])}\b", a) is not None
    return all(has(a, w) for w in rule.get('all', [])) and (not rule.get('any') or any(has(a, w) for w in rule['any']))


def factsheet(brief, tagged=False):
    """The brief's sources, as the builder and the coder see them."""
    return '\n\n'.join(f"### {s['name']}\n\n{s['text'].strip()}" for s in brief['sources'])


def prompt_file(run, name, text, dest):
    tmp = os.environ['CLIMB_TMP']
    folder = os.path.join(tmp, secrets.token_hex(6)); os.makedirs(folder)
    path = os.path.join(folder, f'{secrets.token_hex(4)}.txt')
    open(path, 'w').write(text.rstrip() + '\n')
    out_dir = os.path.join(tmp, secrets.token_hex(6)); os.makedirs(out_dir)
    out = os.path.join(out_dir, f'{secrets.token_hex(4)}.txt')
    index_path = f'{run}/prompts.json'
    index = load(index_path) if os.path.exists(index_path) else {}
    index[name] = {'path': path, 'out': out, 'dest': dest, 'task': TASK.format(path=path, out=out)}
    dump(index_path, index)


def check(kind, path, ctx=None):
    """Return a reason when a reply is unusable, else None."""
    try:
        text = open(path).read()
    except OSError as e:
        return f'no reply file: {e.__class__.__name__}'
    if not text.strip():
        return 'empty reply'
    if kind == 'build':
        if REFUSAL.search(text[:400]):
            return 'refusal or read failure in the opening'
        return None if len(text.split()) >= 200 else f'too short: {len(text.split())} words'
    try:
        r = reply_json(path)
    except (AttributeError, ValueError) as e:
        return f'no JSON: {e}'
    if kind == 'reader':
        for t in ctx:
            v = r.get(t['id'])
            if not isinstance(v, dict) or not isinstance(v.get('answer'), str) or not isinstance(v.get('passages', []), list):
                return f'bad answer for {t["id"]}'
    if kind == 'briefs' and not isinstance(r.get('briefs'), list):
        return 'no briefs list'
    if kind == 'coder' and not isinstance(r.get('cases'), list):
        return 'no cases list'
    return None


def briefs(run):
    return {b['id']: b for b in load(f'{run}/briefs.json')['briefs']}


def kind_of(run, name):
    if name.startswith('build-'):
        return 'build', None
    if name.startswith('reader-'):
        b = next(x for x in load(f'{run}/ledger.json') if x['build'] == name[len('reader-'):])
        return 'reader', briefs(run)[b['brief']]['tasks']
    return name.split('-')[0], None


def cmd_brief_prompt(run, specs):
    pairs = [s.split(':', 1) for s in specs]
    text = BRIEF_WRITER.format(n=len(pairs), types=', '.join(t for _, t in pairs), ids=', '.join(i for i, _ in pairs))
    prompt_file(run, 'briefs-writer', text, f'{run}/briefs-reply.json')


def cmd_freeze_briefs(run):
    r = reply_json(f'{run}/briefs-reply.json')
    for b in r['briefs']:
        src = norm(factsheet(b))
        assert len(b['tasks']) == 5 and isinstance(b['wordLimit'], int), b['id']
        for t in b['tasks']:
            assert 'prefix' in t['rule'] or t['rule'].get('all') or t['rule'].get('any'), (b['id'], t['id'])
            assert grade(t['pass'], t['rule']), (b['id'], t['id'], 'the pass answer fails its own rule')
            for e in t['evidence']:
                assert norm(e).strip(' ."\'') in src, (b['id'], t['id'], 'evidence not in the sources', e)
    dump(f'{run}/briefs.json', r)
    print('frozen', [b['id'] for b in r['briefs']])


def cmd_arm(ref, prose, out):
    show = lambda p: subprocess.run(['git', 'show', f'{ref}:{p}'], capture_output=True, text=True, check=True).stdout
    ls = lambda p: subprocess.run(['git', 'ls-tree', '--name-only', f'{ref}:{p}'], capture_output=True, text=True, check=True).stdout.split()

    def section(text, heading):
        return re.search(rf'^## {re.escape(heading)}\n.*?(?=^## |\Z)', text, flags=re.S | re.M).group(0).strip()

    def delink(text):
        text = re.sub(r'\[([^\]]+)\]\((?:references/)?([\w-]+\.md)(?:#[\w-]+)?\)', r'\1 (the "\2" part of this file)', text)
        text = re.sub(r'\[([^\]]+)\]\((?!https?:)[^)]+\)', r'\1', text)
        text = text.replace("`$workflow:technical-writing`'s", 'the technical-writing')
        return re.sub(r'`\$workflow:([\w-]+)`', r'the \1 guidance', text)

    tw = 'plugins/workflow/skills/technical-writing'
    parts = [('technical-writing/SKILL.md', re.sub(r'^---\n.*?\n---\n', '', show(f'{tw}/SKILL.md'), flags=re.S))]
    for n in ls(f'{tw}/references'):
        text = open(prose).read() if n == 'technical-prose.md' and prose != '-' else show(f'{tw}/references/{n}')
        parts.append((n, text))
    parts.append(('Global guidance: Written deliverables', section(show('host-config/guidance/core.md'), 'Written deliverables')))
    parts.append(('Design language: Copy and density', section(show('host-config/design-language/DESIGN.md'), 'Copy and density')))
    open(out, 'w').write('\n\n'.join(f'<!-- part: {n} -->\n\n{delink(t).strip()}' for n, t in parts) + '\n')


def cmd_builds(run, version, arm, n):
    bs, tmp = briefs(run), os.environ['CLIMB_TMP']
    path = f'{run}/ledger.json'
    ledger = load(path) if os.path.exists(path) else []
    for bid, b in bs.items():
        for attempt in range(1, n + 1):
            build = secrets.token_hex(4)
            folder = os.path.join(tmp, f'g-{secrets.token_hex(6)}'); os.makedirs(folder)
            file = os.path.join(folder, f'{secrets.token_hex(4)}.md')
            if arm == '-':
                open(file, 'w').close()
            else:
                shutil.copyfile(arm, file)
            ledger.append({'build': build, 'version': version, 'brief': bid, 'attempt': attempt, 'file': file})
            prompt_file(run, f'build-{build}', BUILD.format(file=file, brief=b['brief'], facts=factsheet(b, tagged=False)),
                        f'{run}/builds/{build}.md')
    dump(path, ledger)


def cmd_reads(run):
    bs, index = briefs(run), load(f'{run}/prompts.json')
    for b in load(f'{run}/ledger.json'):
        page = f"{run}/builds/{b['build']}.md"
        if f"reader-{b['build']}" in index or not os.path.exists(page):
            continue
        ts = bs[b['brief']]['tasks']
        prompt_file(run, f"reader-{b['build']}", READER.format(page=open(page).read().strip(), tasks=reader_tasks(ts),
                                                               answers=reader_answers(ts), yes_no=yes_no(ts)),
                    f"{run}/reader/{b['build']}.json")


def task_rows(run, version):
    bs = briefs(run)
    rows = []
    for b in load(f'{run}/ledger.json'):
        if b['version'] != version:
            continue
        rpath = f"{run}/reader/{b['build']}.json"
        if not os.path.exists(rpath):
            continue
        md = open(f"{run}/builds/{b['build']}.md").read()
        r = reply_json(rpath)
        for t in bs[b['brief']]['tasks']:
            ans = r[t['id']]
            ok = grade(ans['answer'], t['rule'])
            ds = [depth_of(p, md) for p in ans.get('passages', [])]
            valid = [d for d in ds if d is not None]
            depth = max(valid) if valid else words(md)
            s = (1 - DEPTH_WEIGHT * min(depth / bs[b['brief']]['wordLimit'], 1)) if ok else 0.0
            rows.append({'build': b['build'], 'brief': b['brief'], 'attempt': b['attempt'], 'task': t['id'], 'pass': ok,
                         'depth': depth, 'invalidPassages': len(ds) - len(valid), 'words': words(md), 'score': s,
                         'answer': ans['answer']})
    return rows


def cmd_score(run, version):
    rows = task_rows(run, version)
    for r in rows:
        print(f"{r['brief']}\t{r['attempt']}\t{r['task']}\t{'pass' if r['pass'] else 'FAIL'}\tdepth={r['depth']}\t"
              f"words={r['words']}\tbad={r['invalidPassages']}\t{r['score']:.3f}")
    n = len(rows)
    if n:
        print(f"tasks passed {sum(r['pass'] for r in rows)}/{n}; mean depth {sum(r['depth'] for r in rows) / n:.0f}")
    print(f"{100 * sum(r['score'] for r in rows) / n:.2f}" if n else 'no rows')


def cmd_coder(run, versions):
    bs = briefs(run)
    for bid, b in bs.items():
        cases, labels, k = [], {}, 0
        for v in versions:
            rows = [r for r in task_rows(run, v) if r['brief'] == bid]
            for build in sorted({r['build'] for r in rows}):
                labels[build] = f'p{len(labels) + 1}'
                bad = [r for r in rows if r['build'] == build and (not r['pass'] or r['depth'] > 0.6 * r['words'])]
                page = open(f'{run}/builds/{build}.md').read().strip()
                lines = []
                for r in bad:
                    k += 1
                    t = next(x for x in b['tasks'] if x['id'] == r['task'])
                    lines.append(f"- case c{k}: task \"{t['situation']} {t['question']}\" Correct answer: {t['pass']} "
                                 f"Reader answered: \"{r['answer']}\" ({'passed' if r['pass'] else 'failed'}, depth {r['depth']} of {r['words']} words)")
                cases.append(f"<<<PAGE {labels[build]}\n{page}\nPAGE>>>\n" + ('\n'.join(lines) or '- no failed or deep tasks'))
        dump(f'{run}/coder-labels-{bid}.json', labels)
        prompt_file(run, f'coder-{bid}', CODER.format(brief=b['brief'], page_type=TYPE_LABEL[b['type']],
                                                     facts=factsheet(b, tagged=False), cases='\n\n'.join(cases)),
                    f'{run}/coder/{bid}.json')


def cmd_collect(run):
    index = load(f'{run}/prompts.json')
    missing = []
    for name, e in index.items():
        if os.path.exists(e['dest']):
            continue
        kind, ctx = kind_of(run, name)
        reason = check(kind, e['out'], ctx)
        if reason:
            missing.append((name, reason))
        else:
            os.makedirs(os.path.dirname(e['dest']), exist_ok=True)
            shutil.copyfile(e['out'], e['dest'])
    for name, reason in missing:
        print(f'{name}\t{reason}')
    print(f'{len(index) - len(missing)}/{len(index)} collected')


def cmd_pending(run, prefix=''):
    for name, e in load(f'{run}/prompts.json').items():
        if name.startswith(prefix) and not os.path.exists(e['dest']):
            print(f"{name}\t{e['task']}")


if __name__ == '__main__':
    c, a = sys.argv[1], sys.argv[2:]
    {'brief-prompt': lambda: cmd_brief_prompt(a[0], a[1:]), 'freeze-briefs': lambda: cmd_freeze_briefs(a[0]),
     'arm': lambda: cmd_arm(*a), 'builds': lambda: cmd_builds(a[0], a[1], a[2], int(a[3])),
     'reads': lambda: cmd_reads(a[0]), 'coder': lambda: cmd_coder(a[0], a[1:]), 'collect': lambda: cmd_collect(a[0]),
     'pending': lambda: cmd_pending(*a), 'score': lambda: cmd_score(a[0], a[1])}[c]()

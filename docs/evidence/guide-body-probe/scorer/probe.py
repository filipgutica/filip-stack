# Guide-body probe scorer, for the plan in ../prereg.md. Usage:
#   probe.py tasks <run-dir>                       write one task-writer prompt per brief
#   probe.py freeze-tasks <run-dir>                merge the task replies into tasks.json
#   probe.py init <run-dir> <attempts> <brief>...  write ledger.json, one arm-file copy per
#                                                  build in its own random folder, and build
#                                                  prompts; needs <run-dir>/arms/{base,head}.md
#   probe.py render <run-dir>                      write extractor, reader, double-coding, and
#                                                  judge prompts once the builds are collected
#   probe.py calib-init <run-dir> <calib-dir> [n]  write calibration prompts from
#                                                  <calib-dir>/manifest.json (n pairs, one order,
#                                                  for a dry run)
#   probe.py collect <run-dir> <call> <kind> [ctx] check one reply and copy it into the run
#   probe.py check <kind> <reply-file> [ctx]       exit 1 when a reply is unusable
#   probe.py calib-score <run-dir>                 catch and false-alarm rates; reliable.json
#   probe.py score <run-dir>                       measures, pair outcomes, and the decision rule
# Every prompt and every reply file sits alone in its own random folder under $PROBE_TMP;
# prompts.json maps each call to its files, and `collect` copies a usable reply into the run.
import json, math, os, re, secrets, shutil, subprocess, sys
from prompts import (BUILD, TASK_WRITER, EXTRACTOR, READER, JUDGE, PLAIN_JUDGE, PLAIN, DEFECTS, TASK,
                     questions, defect_questions, reader_tasks, reader_answers, yes_no)

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, 'tools')
ARMS = ['vanilla', 'base', 'head']
# Judges, by the name used in call ids. BUILDER_JUDGE is the builder's own model.
JUDGES = {'sol61': 'gpt-6.1-sol', 'astra': 'gpt-6-astra', 'opus': 'claude-opus-5-5'}
BUILDER_JUDGE = 'sol61'
PAGE_TYPE = {'G1': 'how-to', 'G2': 'explanation', 'G3': 'tutorial'}
TYPE_LABEL = {'how-to': 'how-to guide', 'explanation': 'explanation', 'tutorial': 'tutorial'}
DOUBLE_CODE_SHARE = 0.2
WHERE = {'main', 'disclosure', 'notes', 'link', 'effect_only', 'absent'}
YN = {'yes', 'no'}
DEPTH_MARGIN = 0.10
CATCH_MIN, FALSE_ALARM_MAX, PLAIN_MIN = 3, 0.20, 6
# First person only, so page text such as "if the scanner cannot read the card" passes.
REFUSAL = re.compile(r"\b(i can(no|')t|i am unable|i'm unable|i was unable|i could not|i couldn't)\b", re.I)


def load(path):
    with open(path) as f:
        return json.load(f)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)


def key():
    return load(f'{HERE}/key.json')


def tasks():
    return load(f'{HERE}/tasks.json')


def reply_json(path):
    text = open(path).read()
    return json.loads(re.search(r'\{[\s\S]*\}', text).group(0))


def concept_named(kb_name, names):
    """Match a key concept to an extracted name, ignoring case, plurals, and extra words."""
    stem = kb_name.lower().rstrip('s')
    return next((n for n in names if stem in n.lower() or n.lower().rstrip('s') in kb_name.lower()), None)


def factsheet(brief, tagged):
    text = open(f'{HERE}/factsheets/{brief}.md').read().strip()
    # The builder never sees the tags.
    return text if tagged else text.replace('`[agent-only]` ', '')


def words(text):
    return len(re.findall(r"[A-Za-z0-9][A-Za-z0-9'-]*", text))


def blocks(md):
    """Split a Markdown page into blocks: headings, paragraphs, list items, tables, and code."""
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
        elif s.startswith('#'):
            flush(); cur.append(line); flush()
        elif re.match(r'([-*+]|\d+[.)])\s', s):
            flush(); cur.append(line)
        elif s.startswith('|') and cur and not cur[-1].strip().startswith('|'):
            flush(); cur.append(line)
        else:
            cur.append(line)
    flush()
    return out


def numbered(md):
    return '\n\n'.join(f'[B{i}] {b}' for i, b in enumerate(blocks(md), 1))


def norm(text):
    text = text.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    text = text.replace('–', '-').replace('—', '-')
    text = re.sub(r'[*_`#>]', '', text.lower())
    return re.sub(r'\s+', ' ', text).strip()


def quoted(quote, page):
    """A "yes" counts only when its quote appears in the page."""
    q = norm(quote).strip(' ."\'')
    return bool(q) and q in norm(page)


def shares_run(quote, span, n=5):
    """True when the quote and the planted span share at least n consecutive words."""
    qw, sw = norm(quote).split(), norm(span).split()
    grams = {tuple(sw[i:i + n]) for i in range(len(sw) - n + 1)}
    return any(tuple(qw[i:i + n]) in grams for i in range(len(qw) - n + 1))


def prompt_file(run, name, text, dest):
    """Write one prompt alone in a random folder outside the run and record it. The call
    writes its reply to its own random folder, so no path it sees names the run or the arm."""
    tmp = os.environ['PROBE_TMP']
    folder = os.path.join(tmp, secrets.token_hex(6))
    os.makedirs(folder)
    path = os.path.join(folder, f'{secrets.token_hex(4)}.txt')
    open(path, 'w').write(text.rstrip() + '\n')
    out_dir = os.path.join(tmp, secrets.token_hex(6))
    os.makedirs(out_dir)
    out = os.path.join(out_dir, f'{secrets.token_hex(4)}.txt')
    index_path = f'{run}/prompts.json'
    index = load(index_path) if os.path.exists(index_path) else {}
    index[name] = {'path': path, 'out': out, 'dest': dest, 'task': TASK.format(path=path, out=out)}
    dump(index_path, index)


def collect(run, name, kind, ctx=None):
    """Check one saved reply and copy it into the run. Return the reason when unusable."""
    entry = load(f'{run}/prompts.json')[name]
    reason = check(kind, entry['out'], ctx)
    if reason:
        return reason
    os.makedirs(os.path.dirname(entry['dest']), exist_ok=True)
    shutil.copyfile(entry['out'], entry['dest'])
    return None


# --- Stages -------------------------------------------------------------------------------

def write_tasks(run):
    k = key()
    for brief in sorted(PAGE_TYPE):
        text = TASK_WRITER.format(brief=k[brief]['brief'], page_type=TYPE_LABEL[PAGE_TYPE[brief]],
                                  facts=factsheet(brief, tagged=True))
        prompt_file(run, f'tasks-{brief}', text, f'{run}/tasks/{brief}.json')


def freeze_tasks(run):
    out = {brief: reply_json(f'{run}/tasks/{brief}.json')['tasks'] for brief in sorted(PAGE_TYPE)}
    dump(f'{HERE}/tasks.json', out)


def init(run, attempts, briefs):
    k, tmp = key(), os.environ['PROBE_TMP']
    ledger = []
    for brief in briefs:
        for attempt in range(1, attempts + 1):
            for arm in ARMS:
                build = secrets.token_hex(4)
                folder = os.path.join(tmp, f'g-{secrets.token_hex(6)}')
                os.makedirs(folder)
                file = os.path.join(folder, f'{secrets.token_hex(4)}.md')
                if arm == 'vanilla':
                    open(file, 'w').close()
                else:
                    shutil.copyfile(f'{run}/arms/{arm}.md', file)
                ledger.append({'build': build, 'brief': brief, 'attempt': attempt, 'arm': arm, 'file': file})
                prompt_file(run, f'build-{build}', BUILD.format(file=file, brief=k[brief]['brief'],
                                                                facts=factsheet(brief, tagged=False)),
                            f'{run}/builds/{build}.md')
    dump(f'{run}/ledger.json', ledger)


def judge_text(brief_text, page_type, facts, a, b):
    qs = defect_questions(page_type) + PLAIN
    return JUDGE.format(brief=brief_text, page_type=TYPE_LABEL[page_type], facts=facts, a=a, b=b,
                        questions=questions(qs))


def render(run):
    k, t = key(), tasks()
    ledger = load(f'{run}/ledger.json')
    page = lambda b: open(f"{run}/builds/{b['build']}.md").read().strip()
    for b in ledger:
        kb, bt = k[b['brief']], t[b['brief']]
        text = EXTRACTOR.format(brief=kb['brief'], facts=factsheet(b['brief'], tagged=True), page=numbered(page(b)),
                                case=kb['case']['name'], concepts=', '.join(c['name'] for c in kb['concepts']),
                                nfacts=len(kb['facts']) + len(kb['agentOnly']))
        prompt_file(run, f"extract-{b['build']}", text, f"{run}/extract/{b['build']}.json")
        prompt_file(run, f"reader-{b['build']}", READER.format(page=page(b), tasks=reader_tasks(bt),
                                                              answers=reader_answers(bt), yes_no=yes_no(bt)),
                    f"{run}/reader/{b['build']}.json")
    # Evenly spaced over the ledger order, so each arm and brief gets the same share.
    step = round(1 / DOUBLE_CODE_SHARE)
    coded = [b['build'] for b in ledger[::step]][:max(1, round(len(ledger) * DOUBLE_CODE_SHARE))]
    dump(f'{run}/double-code.json', coded)
    for build in coded:
        prompt_file(run, f'extract2-{build}', open(load(f'{run}/prompts.json')[f'extract-{build}']['path']).read(),
                    f'{run}/extract2/{build}.json')
    # Head against base only, each pair in both orders.
    by = {(b['brief'], b['attempt'], b['arm']): b for b in ledger}
    judge_ledger = []
    for (brief, attempt, arm), head in by.items():
        if arm != 'head' or (brief, attempt, 'base') not in by:
            continue
        other = by[(brief, attempt, 'base')]
        pair = secrets.token_hex(4)
        for order, (a, b) in (('ho', (head, other)), ('oh', (other, head))):
            judge_ledger.append({'pair': pair, 'order': order, 'brief': brief, 'attempt': attempt,
                                 'A': a['arm'], 'B': b['arm'], 'A_build': a['build'], 'B_build': b['build']})
            text = judge_text(k[brief]['brief'], PAGE_TYPE[brief], factsheet(brief, tagged=False), page(a), page(b))
            for j in JUDGES:
                prompt_file(run, f'judge-{pair}-{order}-{j}', text, f'{run}/judges/{pair}-{order}-{j}.json')
    dump(f'{run}/judge-ledger.json', judge_ledger)


def calib_init(run, calib, limit=None):
    """Calibration prompts. The manifest lists each exemplar's type, brief line, fact sheet,
    clean page, and broken copies with their planted spans; the files stay on this machine."""
    m = load(f'{calib}/manifest.json')
    read = lambda p: open(os.path.join(calib, p)).read().strip()
    led = []
    for ex in m['exemplars']:
        for br in ex['broken']:
            pair = secrets.token_hex(4)
            orders = (('cb', (ex['clean'], br['file'])), ('bc', (br['file'], ex['clean'])))
            for order, (a, b) in orders[:1] if limit else orders:
                led.append({'pair': pair, 'order': order, 'exemplar': ex['id'], 'type': ex['type'], 'broken': br['id'],
                            'A': 'clean' if a == ex['clean'] else 'broken', 'spans': br['spans']})
                text = judge_text(ex['brief'], ex['type'], read(ex['factsheet']), read(a), read(b))
                for j in JUDGES:
                    prompt_file(run, f'calib-{pair}-{order}-{j}', text, f'{run}/calib/{pair}-{order}-{j}.json')
            if limit and len({r['pair'] for r in led}) >= limit:
                break
        if limit and len({r['pair'] for r in led}) >= limit:
            break
    pairs = load(f'{calib}/plain-pairs.json')
    plain_led = []
    for order in (('ab',) if limit else ('ab', 'ba')):
        # "ab": the unclear version is A in odd pairs; "ba" swaps every pair.
        rows, text_pairs = [], []
        for i, p in enumerate(pairs, 1):
            unclear_a = (i % 2 == 1) == (order == 'ab')
            a, b = (p['unclear'], p['clear']) if unclear_a else (p['clear'], p['unclear'])
            rows.append({'pair': str(i), 'id': p['id'], 'A': 'unclear' if unclear_a else 'clear'})
            text_pairs.append(f'Pair {i}\nVersion A: {a}\nVersion B: {b}')
        plain_led.append({'order': order, 'rows': rows})
        text = PLAIN_JUDGE.format(pairs='\n\n'.join(text_pairs), questions=questions(PLAIN))
        for j in JUDGES:
            prompt_file(run, f'plain-{order}-{j}', text, f'{run}/plain/{order}-{j}.json')
    m_out = {'pages': {}, 'calib': led, 'plain': plain_led}
    for ex in m['exemplars']:
        m_out['pages'][f"{ex['id']}/clean"] = read(ex['clean'])
        for br in ex['broken']:
            m_out['pages'][f"{ex['id']}/{br['id']}"] = read(br['file'])
    dump(f'{run}/calib-ledger.json', m_out)


# --- Reply checks ---------------------------------------------------------------------------

def check(kind, path, ctx=None):
    """Return a reason when a reply is unusable, else None. The runner stops on any reason."""
    try:
        text = open(path).read()
    except OSError as e:
        return f'unreadable: {e}'
    if not text.strip():
        return 'empty reply'
    if kind == 'build':
        if REFUSAL.search(text[:400]):
            return 'refusal or read failure in the opening'
        return None if len(text.split()) >= 250 else f'too short: {len(text.split())} words'
    try:
        r = reply_json(path)
    except (AttributeError, ValueError) as e:
        return f'no JSON: {e}'
    if kind == 'tasks':
        kb = key()[ctx]
        ts = r.get('tasks')
        if not isinstance(ts, list) or len(ts) != 2:
            return 'need exactly 2 tasks'
        used = set()
        for t in ts:
            if not all(isinstance(t.get(f), str) and t[f] for f in ('id', 'situation', 'question', 'pass')):
                return 'missing task field'
            ids = {str(i) for i in t.get('factIds', [])}
            if not ids or len(ids) > 3 or not ids <= set(kb['facts']):
                return f"task {t['id']}: fact ids must be 1 to 3 reader facts"
            used |= ids
            rule = t.get('rule', {})
            if 'prefix' in rule:
                if rule['prefix'] not in ('yes', 'no'):
                    return f"task {t['id']}: bad prefix"
            else:
                if not isinstance(rule.get('all'), list) or not isinstance(rule.get('any'), list) or not (rule['all'] or rule['any']):
                    return f"task {t['id']}: bad rule"
                asked = (t['situation'] + ' ' + t['question']).lower()
                echo = [w for w in rule['all'] + rule['any'] if w.lower() in asked]
                if echo:
                    return f"task {t['id']}: rule words appear in the task: {echo}"
        return None if len(used) <= len(kb['facts']) // 2 else 'tasks need more than half the reader facts'
    if kind == 'extract':
        kb = key()[ctx]
        ids = {str(f.get('id')) for f in r.get('facts', [])}
        need = set(kb['facts']) | set(kb['agentOnly'])
        if not need <= ids:
            return f'missing fact ids {sorted(need - ids)}'
        if any(f.get('where') not in WHERE for f in r['facts']):
            return 'bad where value'
        if any(f.get('present') and f.get('where') != 'absent' and not isinstance(f.get('block'), int) for f in r['facts']):
            return 'present fact without a block number'
        if not isinstance(r.get('invented_claims'), list) or not isinstance(r.get('forward_dependencies'), list):
            return 'missing list field'
        if not r.get('sections') or any(s.get('kind') not in ('opening', 'body', 'notes') for s in r['sections']):
            return 'bad sections'
        names = [c.get('name', '') for c in r.get('concepts', []) if c.get('name')]
        if not all(concept_named(c['name'], names) for c in kb['concepts']):
            return 'missing concepts'
        return None if r.get('ending') in ('next_action', 'summary', 'other') else 'bad ending'
    if kind == 'reader':
        return None if all(isinstance(r.get(t['id']), str) for t in tasks()[ctx]) else 'missing answer'
    if kind == 'judge':
        need = {q[0] for q in defect_questions(ctx)} | {q[0] for q in PLAIN}
        got = {a.get('q'): a for a in r.get('answers', [])}
        if not need <= set(got):
            return f'missing questions {sorted(need - set(got))}'
        if any(got[q].get(s) not in YN for q in need for s in 'AB'):
            return 'bad yes/no value'
        return None
    if kind == 'plain':
        n = int(ctx)
        ps = {str(p.get('pair')): p for p in r.get('pairs', [])}
        need = {q[0] for q in PLAIN}
        for i in range(1, n + 1):
            got = {a.get('q'): a for a in ps.get(str(i), {}).get('answers', [])}
            if not need <= set(got) or any(got[q].get(s) not in YN for q in need for s in 'AB'):
                return f'pair {i}: missing or bad answers'
        return None
    return f'unknown kind {kind}'


# --- Statistics -----------------------------------------------------------------------------

def wilson(x, n, z=1.96):
    if n == 0:
        return None
    p = x / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [round(x / n, 3), round((c - h) / d, 3), round((c + h) / d, 3)]


def sign_test(wins, losses):
    """Exact one-sided sign test: P(at least `wins` of the non-tied pairs under p = 0.5)."""
    n = wins + losses
    if n == 0:
        return 1.0
    return round(sum(math.comb(n, i) for i in range(wins, n + 1)) / 2 ** n, 4)


# --- Judge verdicts -------------------------------------------------------------------------

def flags_of(reply, pages):
    """Per question, whether each side has a counted "yes": its quote must appear in that page."""
    out = {}
    for a in reply['answers']:
        out[a.get('q')] = {s: a.get(s) == 'yes' and quoted(a.get(f'{s}_quote', ''), pages[s]) for s in 'AB'}
    return out


def order_verdict(fl, head_side):
    other_side = 'B' if head_side == 'A' else 'A'
    h, o = fl[head_side], fl[other_side]
    return 'head' if o and not h else 'other' if h and not o else 'tie'


def consensus(votes):
    """votes: {judge: 'head'|'other'|'tie'} from the judges that count on the question."""
    n = len(votes)
    if n == 0:
        return None
    for side in ('head', 'other'):
        c = sum(v == side for v in votes.values())
        if (n == 3 and c >= 2) or (n < 3 and c == n):
            return side
    return 'tie'


def calib_score(run):
    led = load(f'{run}/calib-ledger.json')
    pages = led['pages']
    seen = {}  # (judge, pair, type) -> list of per-order results
    for row in led['calib']:
        sides = {'A': 'clean' if row['A'] == 'clean' else 'broken', 'B': 'broken' if row['A'] == 'clean' else 'clean'}
        texts = {s: pages[f"{row['exemplar']}/{'clean' if sides[s] == 'clean' else row['broken']}"] for s in 'AB'}
        for j in JUDGES:
            f = f"{run}/calib/{row['pair']}-{row['order']}-{j}.json"
            if not os.path.exists(f):
                continue
            r = reply_json(f)
            for a in r['answers']:
                q = a.get('q')
                res = {}
                for s in 'AB':
                    yes = a.get(s) == 'yes' and quoted(a.get(f'{s}_quote', ''), texts[s])
                    res[sides[s]] = (yes, a.get(f'{s}_quote', ''))
                seen.setdefault((j, row['pair'], q), {'row': row, 'orders': []})['orders'].append(res)
    rates = {}
    for j in JUDGES:
        for qid, name, types, _ in DEFECTS:
            catches = planted = alarms = shown = 0
            for (jj, pair, q), v in seen.items():
                if jj != j or q != qid or v['row']['type'] not in types:
                    continue
                orders = v['orders']
                shown += 1
                alarms += any(o['clean'][0] for o in orders)
                spans = [s['text'] for s in v['row']['spans'] if s['type'] == qid]
                if spans:
                    planted += 1
                    both = len(orders) == 2 or os.environ.get('PROBE_DRY')
                    catches += both and all(o['broken'][0] and any(shares_run(o['broken'][1], sp) for sp in spans)
                                            for o in orders)
            fa = alarms / shown if shown else None
            rates[f'{j}/{qid}'] = {'judge': j, 'q': qid, 'catches': catches, 'planted': planted,
                                   'catch_rate': wilson(catches, planted), 'false_alarms': alarms, 'shown': shown,
                                   'false_alarm_rate': wilson(alarms, shown),
                                   'counts': planted > 0 and catches >= CATCH_MIN and fa is not None and fa <= FALSE_ALARM_MAX}
    plain = {}
    for j in JUDGES:
        ok = {}
        for blk in led['plain']:
            f = f"{run}/plain/{blk['order']}-{j}.json"
            if not os.path.exists(f):
                continue
            ps = {str(p['pair']): p for p in reply_json(f)['pairs']}
            for row in blk['rows']:
                ans = ps[row['pair']]['answers']
                unclear = 'A' if row['A'] == 'unclear' else 'B'
                clear = 'B' if unclear == 'A' else 'A'
                cu = sum(a.get(unclear) == 'yes' for a in ans)
                cc = sum(a.get(clear) == 'yes' for a in ans)
                ok.setdefault(row['id'], []).append(cu > cc)
        passed = sum(1 for v in ok.values() if all(v) and (len(v) == 2 or os.environ.get('PROBE_DRY')))
        plain[j] = {'passed': passed, 'pairs': len(ok), 'rate': wilson(passed, len(ok)), 'counts': passed >= PLAIN_MIN}
    reliable = {q: [j for j in JUDGES if rates.get(f'{j}/{q}', {}).get('counts')]
                for q, *_ in DEFECTS}
    for q, *_ in PLAIN:
        reliable[q] = [j for j in JUDGES if plain[j]['counts']]
    dump(f'{run}/reliable.json', reliable)
    dump(f'{run}/calib-scores.json', {'defects': rates, 'plain': plain, 'reliable': reliable})
    print(json.dumps({'defects': rates, 'plain': plain, 'reliable': reliable}, indent=1))


# --- Measures -------------------------------------------------------------------------------

def prose_sentences(md):
    t = re.sub(r'```.*?```', ' ', md, flags=re.S)
    t = '\n'.join(l for l in t.split('\n') if not l.lstrip().startswith(('#', '|')))
    t = re.sub(r'`[^`]*`', 'CODE', t)
    t = re.sub(r'\s+', ' ', t)
    return [s for s in re.split(r'(?<=[.!?])\s+|\s[-*]\s', t) if len(s.split()) >= 4]


def repetition(md):
    sets = [set(re.findall(r"[a-z][a-z'-]+", s.lower())) for s in prose_sentences(md)]
    return sum(1 for i in range(len(sets)) for j in range(i + 1, len(sets))
               if sets[i] and sets[j] and len(sets[i] & sets[j]) / len(sets[i] | sets[j]) >= 0.6)


def fk_grade(path):
    out = subprocess.run(['python3', '-I', f'{TOOLS}/metrics.py', f'{TOOLS}/vtext.py', path],
                         capture_output=True, text=True, check=True).stdout.strip().split('\n')
    return float(out[1].split()[-2])


def grade(answer, rule):
    a = answer.lower().strip()
    if 'prefix' in rule:
        # A word match, so "no" does not pass "not stated".
        return re.match(rf"{re.escape(rule['prefix'])}\b", a) is not None
    return all(w.lower() in a for w in rule['all']) and (not rule['any'] or any(w.lower() in a for w in rule['any']))


def per_build(run, b, k, t):
    kb, bt = k[b['brief']], t[b['brief']]
    path = f"{run}/builds/{b['build']}.md"
    md = open(path).read()
    blk = blocks(md)
    cum = [0]
    for x in blk:
        cum.append(cum[-1] + words(x))
    total = cum[-1]
    ex = reply_json(f"{run}/extract/{b['build']}.json")
    rd = reply_json(f"{run}/reader/{b['build']}.json")
    facts = {str(f['id']): f for f in ex['facts']}
    present = lambda i: facts.get(i, {}).get('present') and facts[i].get('where') != 'absent'

    def depth(task):
        nums = []
        for i in task['factIds']:
            n = facts.get(str(i), {}).get('block')
            if not present(str(i)) or not isinstance(n, int) or not 1 <= n <= len(blk):
                return total
            nums.append(n)
        return cum[max(nums)]

    passed = {x['id']: grade(rd.get(x['id'], ''), x['rule']) for x in bt}
    depths = {x['id']: depth(x) for x in bt}
    body = [s for s in ex['sections'] if s['kind'] == 'body']
    concepts = {c['name']: c for c in ex['concepts'] if c.get('name')}
    motivated = lambda name: bool(concepts.get(concept_named(name, list(concepts)) or '', {}).get('motivated_first'))
    uses = [i for i, s in enumerate(body) if s.get('uses_case')]
    return {
        **{f: b[f] for f in ('build', 'brief', 'attempt', 'arm')},
        'R1': sum(passed.values()),
        'R2': round(sum(depths.values()) / len(depths), 1),
        'M1': round(sum(1 for i in kb['facts'] if present(i)) / len(kb['facts']), 3),
        'M2': len(ex['invented_claims']),
        # A leak is an agent-only fact anywhere on the page, disclosures and notes included.
        'M3': sum(1 for i in kb['agentOnly'] if present(i) and facts[i].get('where') != 'effect_only'),
        'M7': repetition(md),
        'motivated_share': round(sum(1 for c in kb['concepts'] if motivated(c['name'])) / len(kb['concepts']), 3),
        'case_share': round(len(uses) / len(body), 3) if body else 0.0,
        'ending': ex['ending'], 'body_sections': len(body),
        'forward_dependencies': len(ex['forward_dependencies']),
        'words': total, 'fk_grade': fk_grade(path),
        'reader': {x['id']: [rd.get(x['id'], ''), passed[x['id']], depths[x['id']]] for x in bt},
        'invented_claims': ex['invented_claims'],
    }


def primary(h, o):
    if h['R1'] != o['R1']:
        return 'head' if h['R1'] > o['R1'] else 'other'
    if h['R2'] <= (1 - DEPTH_MARGIN) * o['R2']:
        return 'head'
    if h['R2'] >= (1 + DEPTH_MARGIN) * o['R2']:
        return 'other'
    return 'tie'


def tally(outcomes):
    w, l = outcomes.count('head'), outcomes.count('other')
    return {'wins': w, 'losses': l, 'ties': outcomes.count('tie'), 'p_one_sided': sign_test(w, l),
            'win_share': wilson(w, w + l)}


def judge_verdicts(run, reliable):
    """Per pair and question: each judge's verdict (both orders agree, else tie) and the consensus."""
    rows = load(f'{run}/judge-ledger.json')
    page = lambda build: open(f'{run}/builds/{build}.md').read()
    per = {}  # (pair, q) -> {judge: [order verdicts]}
    meta = {}
    for row in rows:
        texts = {'A': page(row['A_build']), 'B': page(row['B_build'])}
        head_side = 'A' if row['A'] == 'head' else 'B'
        meta[row['pair']] = {'brief': row['brief'], 'attempt': row['attempt']}
        for j in JUDGES:
            f = f"{run}/judges/{row['pair']}-{row['order']}-{j}.json"
            if not os.path.exists(f):
                continue
            for q, fl in flags_of(reply_json(f), texts).items():
                per.setdefault((row['pair'], q), {}).setdefault(j, []).append(order_verdict(fl, head_side))
    out, disagree = {}, {}
    for (pair, q), byj in per.items():
        final = {}
        for j, vs in byj.items():
            final[j] = vs[0] if len(vs) == 2 and vs[0] == vs[1] else 'tie'
            if len(vs) == 2:
                d = disagree.setdefault(j, [0, 0])
                d[0] += vs[0] != vs[1]
                d[1] += 1
        counted = {j: v for j, v in final.items() if j in reliable.get(q, [])}
        out.setdefault(q, []).append({**meta[pair], 'pair': pair, 'judges': final, 'consensus': consensus(counted),
                                      'builder_only': counted.get(BUILDER_JUDGE) == 'head'
                                      and sum(v == 'head' for v in counted.values()) == 1})
    order_rates = {j: wilson(d[0], d[1]) for j, d in disagree.items()}
    return out, order_rates


def score(run):
    k, t = key(), tasks()
    builds = [per_build(run, b, k, t) for b in load(f'{run}/ledger.json')]
    by = {(b['brief'], b['attempt'], b['arm']): b for b in builds}
    briefs = sorted({b['brief'] for b in builds})
    agg = {}
    for brief in briefs:
        for arm in ARMS:
            rows = [b for b in builds if b['brief'] == brief and b['arm'] == arm]
            if rows:
                n = len(rows)
                agg[f'{brief}/{arm}'] = {
                    'R1_rate': wilson(sum(r['R1'] for r in rows), 2 * n),
                    'R2_mean': round(sum(r['R2'] for r in rows) / n, 1),
                    'M1_mean': round(sum(r['M1'] for r in rows) / n, 3),
                    'M2_sum': sum(r['M2'] for r in rows), 'M3_sum': sum(r['M3'] for r in rows),
                    'M7_sum': sum(r['M7'] for r in rows),
                    'words_mean': round(sum(r['words'] for r in rows) / n, 1),
                    'fk_mean': round(sum(r['fk_grade'] for r in rows) / n, 2),
                    'motivated_mean': round(sum(r['motivated_share'] for r in rows) / n, 3),
                    'case_mean': round(sum(r['case_share'] for r in rows) / n, 3),
                    'endings': {e: sum(r['ending'] == e for r in rows) for e in ('next_action', 'summary', 'other')},
                }
    pairs = {other: [(brief, a) for (brief, a, arm) in by if arm == 'head' and (brief, a, other) in by]
             for other in ('base', 'vanilla')}
    prim = {other: {f'{b}/{a}': primary(by[(b, a, 'head')], by[(b, a, other)]) for b, a in sorted(ps)}
            for other, ps in pairs.items()}
    m7 = {f'{b}/{a}': ('head' if by[(b, a, 'head')]['M7'] < by[(b, a, 'base')]['M7'] else
                       'other' if by[(b, a, 'head')]['M7'] > by[(b, a, 'base')]['M7'] else 'tie')
          for b, a in sorted(pairs['base'])}
    reliable = load(f'{run}/reliable.json')
    verdicts, order_rates = judge_verdicts(run, reliable) if os.path.exists(f'{run}/judge-ledger.json') else ({}, {})
    judged = {q: tally([v['consensus'] for v in vs if v['consensus']]) for q, vs in verdicts.items()}
    restatement = ('D3', judged.get('D3')) if reliable.get('D3') else ('M7', tally(list(m7.values())))
    no_harm = {}
    for other in ('base', 'vanilla'):
        for brief in briefs:
            h, o = agg.get(f'{brief}/head'), agg.get(f'{brief}/{other}')
            if h and o:
                no_harm[f'{brief}/{other}'] = (h['M1_mean'] >= o['M1_mean'] - 0.05 and h['M2_sum'] <= o['M2_sum'] + 1
                                               and h['M3_sum'] <= o['M3_sum'] + 1)
    t_base, t_van = tally(list(prim['base'].values())), tally(list(prim['vanilla'].values()))
    m3 = lambda arm: sum(agg[f'{b}/{arm}']['M3_sum'] for b in briefs if f'{b}/{arm}' in agg)
    rule = {
        '1_reader_vs_base': t_base['p_one_sided'] <= 0.05 and t_base['wins'] > t_base['losses'],
        '2_reader_vs_vanilla': t_van['wins'] > t_van['losses'],
        '3_no_harm': bool(no_harm) and all(no_harm.values()),
        '4_targeted': bool(restatement[1]) and restatement[1]['wins'] > restatement[1]['losses'] and m3('head') <= m3('base'),
    }
    flags = []
    for q, vs in verdicts.items():
        if any(v['consensus'] == 'head' and v['builder_only'] for v in vs):
            flags.append(f'builder-model only: a {q} win rests on {JUDGES[BUILDER_JUDGE]} alone')
    for other in ('base', 'vanilla'):
        for brief in briefs:
            h, o = agg.get(f'{brief}/head'), agg.get(f'{brief}/{other}')
            wins = [v for key_, v in prim[other].items() if key_.startswith(brief + '/')]
            if h and o and h['words_mean'] > 1.2 * o['words_mean'] and wins.count('head') > len(wins) / 2:
                flags.append(f'length: {brief} head {h["words_mean"]} words vs {other} {o["words_mean"]}')
    for j, r in order_rates.items():
        if r and r[0] > 0.30:
            flags.append(f'order: {j} disagrees with itself on {r[0]:.0%} of question verdicts')
    total_briefs = int(os.environ.get('PROBE_BRIEFS', '3'))
    verdict = (f'not decidable: {len(briefs)} of {total_briefs} briefs scored' if len(briefs) < total_briefs else
               'supported' if all(rule.values()) else 'not supported')
    result = {'aggregate': agg, 'primary': {'vs_base': t_base, 'vs_vanilla': t_van, 'pairs': prim},
              'restatement': {'measure': restatement[0], 'tally': restatement[1]},
              'judged': judged, 'no_harm': no_harm, 'M3_total': {a: m3(a) for a in ARMS},
              'rule': rule, 'flags': flags, 'order_disagreement': order_rates, 'verdict': verdict,
              'double_coding': double_code_agreement(run, k)}
    dump(f'{run}/scores.json', {'builds': builds, 'verdicts': verdicts, **result})
    print(json.dumps(result, indent=1))


def double_code_agreement(run, k):
    """Share of extractor judgments the second model matches, over the double-coded builds."""
    ledger = {b['build']: b for b in load(f'{run}/ledger.json')}
    coded = [b for b in load(f'{run}/double-code.json') if os.path.exists(f'{run}/extract2/{b}.json')]
    if not coded:
        return None
    same = total = 0
    for build in coded:
        one, two = reply_json(f'{run}/extract/{build}.json'), reply_json(f'{run}/extract2/{build}.json')
        kb = k[ledger[build]['brief']]
        f1, f2 = ({str(f['id']): f for f in e['facts']} for e in (one, two))
        for i in [*kb['facts'], *kb['agentOnly']]:
            for field in ('present', 'block'):
                same += f1.get(i, {}).get(field) == f2.get(i, {}).get(field)
                total += 1

        def mot(e, name):
            cs = {c['name']: c for c in e['concepts'] if c.get('name')}
            return bool(cs.get(concept_named(name, list(cs)) or '', {}).get('motivated_first'))
        for c in kb['concepts']:
            same += mot(one, c['name']) == mot(two, c['name'])
            total += 1
    return {'builds': coded, 'agreement': wilson(same, total)}


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'init':
        init(sys.argv[2], int(sys.argv[3]), sys.argv[4:])
    elif cmd == 'calib-init':
        calib_init(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else None)
    elif cmd in ('collect', 'check'):
        reason = collect(*sys.argv[2:5], *sys.argv[5:6]) if cmd == 'collect' else check(*sys.argv[2:4], *sys.argv[4:5])
        print(reason or 'ok')
        sys.exit(1 if reason else 0)
    else:
        {'tasks': write_tasks, 'freeze-tasks': freeze_tasks, 'render': render,
         'calib-score': calib_score, 'score': score}[cmd](sys.argv[2])

# Guide-body probe scorer. Usage:
#   probe.py init <run-dir> <attempts> <brief>...  write ledger.json, one arm-file copy per
#                                                  build in its own random folder, and build
#                                                  prompts; needs <run-dir>/arms/{base,head}.md
#   probe.py render <run-dir>                      write scoring prompts, the judge ledger,
#                                                  and the double-coding list
#   probe.py check <kind> <reply-file> [brief]     exit 1 when a reply is unusable
#   probe.py score <run-dir>                       compute measures and the decision rule
# After the calls, <run-dir> holds builds/<build>.md, extract/<build>.json,
# comp/<build>.json, judges/<pair>-<judge>.json, and extract2/<build>.json for the
# double-coded builds. Every prompt file sits alone in its own random folder; prompts.json
# maps each call to its file.
import json, os, re, secrets, shutil, subprocess, sys
from prompts import BUILD, EXTRACTOR, COMPREHENSION, JUDGE, TASK, yes_no

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, 'tools')
ARMS = ['vanilla', 'base', 'head']
PAIRINGS = ['base', 'vanilla']
JUDGES = ['astra', 'sol', 'opus']
DOUBLE_CODE_SHARE = 0.2
GAIN = ['M4', 'M5', 'M6', 'M7']
LOWER = {'M2', 'M3', 'M7'}
WHERE = {'main', 'disclosure', 'notes', 'link', 'effect_only', 'absent'}
VOTE = {'A', 'B', 'SAME'}
REFUSAL = re.compile(r"\b(i can(no|')t|i am unable|i'm unable|unable to (read|open|access)|could not (read|open|access)|cannot (read|open|access))\b", re.I)


def load(path):
    with open(path) as f:
        return json.load(f)


def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)


def key():
    return load(f'{HERE}/key.json')


def reply_json(path):
    text = open(path).read()
    return json.loads(re.search(r'\{[\s\S]*\}', text).group(0))


def factsheet(brief, tagged):
    text = open(f'{HERE}/factsheets/{brief}.md').read().strip()
    # The builder never sees the tags.
    return text if tagged else text.replace('`[agent-only]` ', '')


def prompt_file(run, name, text, tmp):
    """Write one prompt alone in a random folder outside the run and record it."""
    folder = os.path.join(tmp, secrets.token_hex(6))
    os.makedirs(folder)
    path = os.path.join(folder, f'{secrets.token_hex(4)}.txt')
    open(path, 'w').write(text.rstrip() + '\n')
    index_path = f'{run}/prompts.json'
    index = load(index_path) if os.path.exists(index_path) else {}
    index[name] = {'path': path, 'task': TASK.format(path=path)}
    dump(index_path, index)


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
                                                                facts=factsheet(brief, tagged=False)), tmp)
    dump(f'{run}/ledger.json', ledger)


def render(run):
    k, tmp = key(), os.environ['PROBE_TMP']
    ledger = load(f'{run}/ledger.json')
    page = lambda b: open(f"{run}/builds/{b['build']}.md").read().strip()
    for b in ledger:
        kb = k[b['brief']]
        text = EXTRACTOR.format(brief=kb['brief'], facts=factsheet(b['brief'], tagged=True), page=page(b),
                                case=kb['case']['name'], concepts=', '.join(c['name'] for c in kb['concepts']),
                                nfacts=len(kb['facts']) + len(kb['agentOnly']))
        prompt_file(run, f"extract-{b['build']}", text, tmp)
        prompt_file(run, f"comp-{b['build']}", COMPREHENSION.format(page=page(b), yes_no=yes_no(kb['answerKey']),
                                                                   **kb['questions']), tmp)
    # Evenly spaced over the ledger order, so each arm and brief gets the same share.
    step = round(1 / DOUBLE_CODE_SHARE)
    coded = [b['build'] for b in ledger[::step]][:max(1, round(len(ledger) * DOUBLE_CODE_SHARE))]
    dump(f'{run}/double-code.json', coded)
    for build in coded:
        prompt_file(run, f'extract2-{build}', open(load(f'{run}/prompts.json')[f'extract-{build}']['path']).read(), tmp)
    by = {(b['brief'], b['attempt'], b['arm']): b for b in ledger}
    judge_ledger = []
    for (brief, attempt, arm), head in by.items():
        if arm != 'head':
            continue
        for i, other in enumerate(PAIRINGS):
            o = by[(brief, attempt, other)]
            pair = secrets.token_hex(4)
            # Balanced order: across attempts and pairings, head is A in half the pairs.
            a, b = (head, o) if (attempt + i) % 2 == 0 else (o, head)
            judge_ledger.append({'pair': pair, 'brief': brief, 'attempt': attempt, 'pairing': f'head-vs-{other}',
                                 'A': a['arm'], 'B': b['arm'], 'A_build': a['build'], 'B_build': b['build']})
            text = JUDGE.format(brief=k[brief]['brief'], a=page(a), b=page(b))
            for j in JUDGES:
                prompt_file(run, f'judge-{pair}-{j}', text, tmp)
    dump(f'{run}/judge-ledger.json', judge_ledger)


def check(kind, path, brief=None):
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
    if kind == 'extract':
        kb = key()[brief]
        ids = {str(f.get('id')) for f in r.get('facts', [])}
        need = set(kb['facts']) | set(kb['agentOnly'])
        if not need <= ids:
            return f'missing fact ids {sorted(need - ids)}'
        if any(f.get('where') not in WHERE for f in r['facts']):
            return 'bad where value'
        if not isinstance(r.get('invented_claims'), list) or not isinstance(r.get('forward_dependencies'), list):
            return 'missing list field'
        if not r.get('sections') or any(s.get('kind') not in ('opening', 'body', 'notes') for s in r['sections']):
            return 'bad sections'
        names = {c.get('name', '').lower() for c in r.get('concepts', [])}
        if not {c['name'].lower() for c in kb['concepts']} <= names:
            return 'missing concepts'
        return None if r.get('ending') in ('next_action', 'summary', 'other') else 'bad ending'
    if kind == 'comp':
        return None if all(isinstance(r.get(q), str) for q in 'abcd') else 'missing answer'
    if kind == 'judge':
        return None if all(r.get(q) in VOTE for q in ('follow', 'story', 'overall')) else 'bad vote'
    return f'unknown kind {kind}'


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


def words_and_grade(path):
    out = subprocess.run(['python3', '-I', f'{TOOLS}/metrics.py', f'{TOOLS}/vtext.py', path],
                         capture_output=True, text=True, check=True).stdout.strip().split('\n')
    row = out[1].split()
    return int(float(row[-5])), float(row[-2])


def grade(answer, rule):
    a = answer.lower().strip()
    if 'prefix' in rule:
        # A word match, so "no" does not pass "not stated".
        return re.match(rf"{re.escape(rule['prefix'])}\b", a) is not None
    if 'patterns' in rule:
        return all(re.search(p, a) for p in rule['patterns'])
    return all(w in a for w in rule['all']) and (not rule['any'] or any(w in a for w in rule['any']))


def per_build(run, b, k):
    kb = k[b['brief']]
    path = f"{run}/builds/{b['build']}.md"
    ex = reply_json(f"{run}/extract/{b['build']}.json")
    comp = reply_json(f"{run}/comp/{b['build']}.json")
    facts = {str(f['id']): f for f in ex['facts']}
    present = lambda i: facts.get(i, {}).get('present') and facts[i].get('where') != 'absent'
    body = [s for s in ex['sections'] if s['kind'] == 'body']
    concepts = {c['name'].lower(): c for c in ex['concepts']}
    graded = {q: grade(comp.get(q, ''), kb['answerKey'][q]) for q in kb['questions']}
    words, fk = words_and_grade(path)
    return {
        **{f: b[f] for f in ('build', 'brief', 'attempt', 'arm')},
        'M1': round(sum(1 for i in kb['facts'] if present(i)) / len(kb['facts']), 3),
        'M2': len(ex['invented_claims']),
        # A leak is an agent-only fact anywhere on the page, disclosures and notes included.
        'M3': sum(1 for i in kb['agentOnly'] if present(i) and facts[i].get('where') != 'effect_only'),
        'M3_main': sum(1 for i in kb['agentOnly'] if present(i) and facts[i].get('where') == 'main'),
        'M4': sum(graded.values()),
        'M5': round(sum(1 for s in body if s.get('uses_case')) / len(body), 3) if body else 0.0,
        'M6': round(sum(1 for c in kb['concepts'] if concepts.get(c['name'].lower(), {}).get('motivated_first'))
                    / len(kb['concepts']), 3),
        'M7': repetition(open(path).read()),
        'body_sections': len(body), 'ending': ex['ending'],
        'forward_dependencies': len(ex['forward_dependencies']),
        'words': words, 'fk_grade': fk,
        'M4_answers': {q: [comp.get(q, ''), graded[q]] for q in graded},
        'invented_claims': ex['invented_claims'],
    }


def aggregate(m, values):
    # Shares are averaged over attempts; counts are summed.
    return round(sum(values) / len(values), 3) if m in ('M1', 'M5', 'M6') else round(sum(values), 3)


def better(m, h, o):
    return h < o if m in LOWER else h > o


def decision(agg, votes, briefs_required=2, total_briefs=3):
    out = {'per_brief': {}}
    for brief in sorted({key.split('/')[0] for key in agg}):
        h, entry = agg.get(f'{brief}/head'), {}
        for other in PAIRINGS:
            o = agg.get(f'{brief}/{other}')
            if not (h and o):
                continue
            overall = [v['overall'] for v in votes if v['brief'] == brief and v['pairing'] == f'head-vs-{other}']
            half = len(overall) / 2
            entry[other] = {
                'no_harm': h['M1'] >= o['M1'] - 0.05 and h['M2'] <= o['M2'] + 1 and h['M3'] <= o['M3'] + 1,
                'better_on': [m for m in GAIN if better(m, h[m], o[m])],
                'worse_on_M5_or_M6': [m for m in ('M5', 'M6') if better(m, o[m], h[m])],
                'votes': {arm: overall.count(arm) for arm in ('head', other, 'SAME')},
                'head_majority': overall.count('head') > half,
                'other_majority': overall.count(other) > half,
            }
            entry[other]['objective_gain'] = len(entry[other]['better_on']) >= 2
        out['per_brief'][brief] = entry
    pb = out['per_brief'].values()
    base = [e['base'] for e in pb if 'base' in e]
    van = [e['vanilla'] for e in pb if 'vanilla' in e]
    out['vs_base'] = {
        'part1_no_harm': all(e['no_harm'] for e in base),
        'part2_objective_gain': sum(e['objective_gain'] for e in base) >= briefs_required
                                and not any(e['worse_on_M5_or_M6'] for e in base),
        'part3_judges': sum(e['head_majority'] for e in base) >= briefs_required and not any(e['other_majority'] for e in base),
    }
    out['vs_vanilla'] = {
        'part1_no_harm': all(e['no_harm'] for e in van),
        'part3_judges': sum(e['head_majority'] for e in van) >= briefs_required and not any(e['other_majority'] for e in van),
    }
    n = len(out['per_brief'])
    out['briefs_scored'] = n
    out['verdict'] = (f'not decidable: {n} of {total_briefs} briefs scored' if n < total_briefs else
                      'supported' if all(out['vs_base'].values()) and all(out['vs_vanilla'].values()) else 'not supported')
    return out


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
            for field in ('present', 'where'):
                same += f1.get(i, {}).get(field) == f2.get(i, {}).get(field)
                total += 1
        c1, c2 = ({c['name'].lower(): c for c in e['concepts']} for e in (one, two))
        for c in kb['concepts']:
            same += bool(c1.get(c['name'].lower(), {}).get('motivated_first')) == bool(c2.get(c['name'].lower(), {}).get('motivated_first'))
            total += 1
        uses = lambda e: sum(1 for s in e['sections'] if s['kind'] == 'body' and s.get('uses_case'))
        same += uses(one) == uses(two)
        total += 1
    return {'builds': coded, 'agreement': round(same / total, 3)}


def score(run):
    k = key()
    builds = [per_build(run, b, k) for b in load(f'{run}/ledger.json')]
    votes = []
    for p in load(f'{run}/judge-ledger.json'):
        for j in JUDGES:
            f = f"{run}/judges/{p['pair']}-{j}.json"
            if not os.path.exists(f):
                continue
            r = reply_json(f)
            arm = lambda v: p[v] if v in ('A', 'B') else 'SAME'
            votes.append({**p, 'judge': j, **{q: arm(r.get(q)) for q in ('follow', 'story', 'overall')}, 'reason': r.get('reason')})
    agg = {}
    for brief in sorted({b['brief'] for b in builds}):
        for arm in ARMS:
            rows = [b for b in builds if b['brief'] == brief and b['arm'] == arm]
            if rows:
                agg[f'{brief}/{arm}'] = {m: aggregate(m, [r[m] for r in rows])
                                         for m in ['M1', 'M2', 'M3', 'M3_main', 'M4', 'M5', 'M6', 'M7', 'words']}
    rule = decision(agg, votes, total_briefs=int(os.environ.get('PROBE_BRIEFS', '3')))
    agreement = double_code_agreement(run, k)
    dump(f'{run}/scores.json', {'builds': builds, 'votes': votes, 'aggregate': agg, 'rule': rule, 'double_coding': agreement})
    print(json.dumps({'aggregate': agg, 'rule': rule, 'double_coding': agreement}, indent=1))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'init':
        init(sys.argv[2], int(sys.argv[3]), sys.argv[4:])
    elif cmd == 'check':
        reason = check(sys.argv[2], sys.argv[3], *(sys.argv[4:5]))
        print(reason or 'ok')
        sys.exit(1 if reason else 0)
    else:
        {'render': render, 'score': score}[cmd](sys.argv[2])

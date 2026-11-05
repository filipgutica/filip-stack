# Writing probe scorer. Usage:
#   probe.py prepare <run-dir>  write build prompts from ledger.json
#   probe.py render <run-dir>   write scoring prompts, the blind judge ledger, and the
#                               double-coding list
#   probe.py score <run-dir>    compute measures and the decision rule
# ledger.json lists builds in brief, attempt, arm order. After the calls, <run-dir> holds
# builds/<build>.md, extract/<build>.json, comp/<build>.json, judges/<pair>-<judge>.json,
# and, for the double-coded builds, extract2/<build>.json.
import json, os, re, secrets, subprocess, sys
from prompts import BUILD, EXTRACTOR, COMPREHENSION, JUDGE, yes_no

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.environ.get('PROBE_TOOLS', os.path.join(HERE, 'tools'))
BRIEFS = {
    'B1': 'Write the landing page copy for `portlog`, following the tool page section order.',
    'B2': 'Write the docs-site page for the `release-notes` skill with the sections What it does, When to use it, How it works, and What you get.',
    'B3': "Write the README's opening paragraph and its Install and update section for the `tidy-hooks` plugin.",
    'B4': "Write the first two sections, about 350 words, of a lesson for engineers titled 'Flaky tests and agents'.",
}
PAIRINGS = ['base', 'vanilla']
DOUBLE_CODE_SHARE = 0.2
JUDGES = ['astra', 'sol', 'opus']
MEASURES = ['M3', 'M4', 'M5', 'M6', 'M9']
LOWER = {'M2', 'M3', 'M5', 'M6', 'M7', 'M8'}

def load(path):
    with open(path) as f:
        return json.load(f)

def dump(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=1)

def reply_json(path):
    text = open(path).read()
    return json.loads(re.search(r'\{[\s\S]*\}', text).group(0))

def factsheet(brief, tagged):
    text = open(f'{HERE}/factsheets/{brief}.md').read().strip()
    # The builder never sees the tags; see the dry-run report's clarifications.
    return text if tagged else text.replace('`[agent-only]` ', '')

def prepare(run):
    os.makedirs(f'{run}/prompts', exist_ok=True)
    for b in load(f'{run}/ledger.json'):
        open(f"{run}/prompts/build-{b['build']}.txt", 'w').write(
            BUILD.format(file=b['file'], brief=BRIEFS[b['brief']], facts=factsheet(b['brief'], tagged=False)) + '\n')

def render(run):
    key = load(f'{HERE}/key.json')
    ledger = load(f'{run}/ledger.json')
    os.makedirs(f'{run}/prompts', exist_ok=True)
    judge_ledger = []
    for b in ledger:
        k = key[b['brief']]
        page = open(f"{run}/builds/{b['build']}.md").read().strip()
        nfacts = len(k['facts']) + len(k['agentOnly'])
        open(f"{run}/prompts/extract-{b['build']}.txt", 'w').write(
            EXTRACTOR.format(brief=BRIEFS[b['brief']], facts=factsheet(b['brief'], tagged=True), page=page, nfacts=nfacts))
        open(f"{run}/prompts/comp-{b['build']}.txt", 'w').write(
            COMPREHENSION.format(page=page, yes_no=yes_no(k['answerKey']), **k['questions']))
    # Evenly spaced over the ledger order, so each arm gets the same share.
    step = round(1 / DOUBLE_CODE_SHARE)
    dump(f'{run}/double-code.json', [b['build'] for b in ledger[::step][:int(len(ledger) * DOUBLE_CODE_SHARE)]])
    by = {(b['brief'], b['attempt'], b['arm']): b for b in ledger}
    for (brief, attempt, arm), head in by.items():
        if arm != 'head':
            continue
        for i, other in enumerate(PAIRINGS):
            o = by.get((brief, attempt, other))
            if not o:
                continue
            pair = secrets.token_hex(4)
            # Balanced order: across attempts and pairings, head is A in half the pairs.
            a, b = (head, o) if (attempt + i) % 2 == 0 else (o, head)
            judge_ledger.append({'pair': pair, 'brief': brief, 'attempt': attempt, 'pairing': f'head-vs-{other}',
                                 'A': a['arm'], 'B': b['arm'], 'A_build': a['build'], 'B_build': b['build']})
            text = lambda x: open(f"{run}/builds/{x['build']}.md").read().strip()
            open(f'{run}/prompts/judge-{pair}.txt', 'w').write(JUDGE.format(brief=BRIEFS[brief], a=text(a), b=text(b)))
    dump(f'{run}/judge-ledger.json', judge_ledger)

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

def start_offset(md, pattern):
    if pattern is None:
        return None  # The brief has no install step or command to find.
    m = re.search(pattern, md)
    words = len(md.split())
    return round(len(md[:m.start()].split()) / words, 3) if m else 1.0

def tool_row(script, path):
    out = subprocess.run(['python3', '-I', f'{TOOLS}/{script}', f'{TOOLS}/vtext.py', path],
                         capture_output=True, text=True, check=True).stdout.strip().split('\n')
    head, row = out[0].split(), out[1].split()
    return dict(zip(head[1:], map(float, row[-len(head) + 1:])))

def grade(answer, rule):
    a = answer.lower().strip()
    if 'prefix' in rule:
        # A word match, so "no" does not pass "not stated".
        return re.match(rf"{re.escape(rule['prefix'])}\b", a) is not None
    return all(w in a for w in rule['all']) and (not rule['any'] or any(w in a for w in rule['any']))

def per_build(run, b, key):
    k = key[b['brief']]
    path = f"{run}/builds/{b['build']}.md"
    md = open(path).read()
    ex = reply_json(f"{run}/extract/{b['build']}.json")
    comp = reply_json(f"{run}/comp/{b['build']}.json")
    facts = {str(f['id']): f for f in ex['facts']}
    reader_ids, agent_ids = list(k['facts']), list(k['agentOnly'])
    tells = tool_row('tells.py', path)
    metrics = tool_row('metrics.py', path)
    graded = {q: grade(comp.get(q, ''), k['answerKey'][q]) for q in k['questions']}
    return {
        **b,
        'M1': round(sum(1 for i in reader_ids if facts.get(i, {}).get('present')) / len(reader_ids), 3),
        'M2': len(ex['invented_claims']),
        'M3': sum(1 for i in agent_ids if facts.get(i, {}).get('present') and facts[i].get('where') == 'explanation'),
        'M4': int(bool(ex['opening'].get('names_subject_and_job')) and bool(ex['opening'].get('reason_within_first_120_words'))),
        'M5': start_offset(md, k['start']),
        'M6': round(len(ex['fragments']) / max(1, ex['sentences']), 3),
        'M6_regex_fragments': int(tells['fragment']),
        'M7': int(sum(v for k2, v in tells.items() if k2 not in ('fragment', 'words'))),
        'M8': repetition(md),
        'M9': sum(graded.values()),
        'M9_answers': {q: [comp.get(q, ''), graded[q]] for q in graded},
        'words': int(metrics['words']), 'fk_grade': metrics['FKgrade'],
        'invented_claims': ex['invented_claims'], 'fragments': ex['fragments'],
    }

def score(run):
    key = load(f'{HERE}/key.json')
    builds = [per_build(run, b, key) for b in load(f'{run}/ledger.json')]
    votes = []
    for p in load(f'{run}/judge-ledger.json'):
        for j in JUDGES:
            f = f"{run}/judges/{p['pair']}-{j}.json"
            if not os.path.exists(f):
                continue
            r = reply_json(f)
            arm = lambda v: p[v] if v in ('A', 'B') else 'SAME'
            votes.append({**p, 'judge': j, **{q: arm(r.get(q)) for q in ('reader', 'careful', 'overall')}, 'reason': r.get('reason')})
    agg = {}
    for brief in sorted({b['brief'] for b in builds}):
        for arm in ('vanilla', 'base', 'head'):
            rows = [b for b in builds if b['brief'] == brief and b['arm'] == arm]
            if rows:
                agg[f'{brief}/{arm}'] = {m: aggregate(m, [r[m] for r in rows])
                                         for m in ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'words']}
    rule = decision(agg, votes)
    agreement = double_code_agreement(run, key)
    dump(f'{run}/scores.json', {'builds': builds, 'votes': votes, 'aggregate': agg, 'rule': rule, 'double_coding': agreement})
    print(json.dumps({'aggregate': agg, 'rule': rule, 'double_coding': agreement}, indent=1))

def aggregate(m, values):
    if None in values:
        return None
    return round(sum(values) / len(values), 3) if m == 'M1' else round(sum(values), 3)

def double_code_agreement(run, key):
    """Share of extractor judgments the second model matches, over the double-coded builds."""
    ledger = {b['build']: b for b in load(f'{run}/ledger.json')}
    path = f'{run}/double-code.json'
    coded = [b for b in (load(path) if os.path.exists(path) else []) if os.path.exists(f'{run}/extract2/{b}.json')]
    if not coded:
        return None
    same = total = 0
    for build in coded:
        one, two = reply_json(f'{run}/extract/{build}.json'), reply_json(f'{run}/extract2/{build}.json')
        f1, f2 = ({str(f['id']): f for f in e['facts']} for e in (one, two))
        k = key[ledger[build]['brief']]
        for i in [*k['facts'], *k['agentOnly']]:
            for field in ('present', 'where'):
                same += f1.get(i, {}).get(field) == f2.get(i, {}).get(field)
                total += 1
        for field in ('names_subject_and_job', 'reason_within_first_120_words'):
            same += bool(one['opening'].get(field)) == bool(two['opening'].get(field))
            total += 1
    return {'builds': coded, 'agreement': round(same / total, 3)}

def better(m, h, o):
    if h is None or o is None:
        return False  # Not measured on this brief, so neither better nor worse.
    return h < o if m in LOWER else h > o

def decision(agg, votes, briefs_required=3, total_briefs=4):
    out = {'per_brief': {}}
    for brief in sorted({k.split('/')[0] for k in agg}):
        h, entry = agg.get(f'{brief}/head'), {}
        for other in PAIRINGS:
            o = agg.get(f'{brief}/{other}')
            if not (h and o):
                continue
            overall = [v['overall'] for v in votes if v['brief'] == brief and v['pairing'] == f'head-vs-{other}']
            half = len(overall) / 2
            entry[other] = {
                'no_harm': h['M1'] >= o['M1'] - 0.05 and h['M2'] <= o['M2'] + 1,
                'better_on': [m for m in MEASURES if better(m, h[m], o[m])],
                'worse_on_M3_or_M4': [m for m in ('M3', 'M4') if better(m, o[m], h[m])],
                'votes': {arm: overall.count(arm) for arm in ('head', other, 'SAME')},
                'head_majority': overall.count('head') > half,
                'other_majority': overall.count(other) > half,
            }
            entry[other]['objective_gain'] = len(entry[other]['better_on']) >= 2
        out['per_brief'][brief] = entry
    n = len(out['per_brief'])
    pb = out['per_brief'].values()
    base = [e['base'] for e in pb if 'base' in e]
    van = [e['vanilla'] for e in pb if 'vanilla' in e]
    out['vs_base'] = {
        'part1_no_harm': all(e['no_harm'] for e in base),
        'part2_objective_gain': sum(e['objective_gain'] for e in base) >= briefs_required and not any(e['worse_on_M3_or_M4'] for e in base),
        'part3_judges': sum(e['head_majority'] for e in base) >= briefs_required and not any(e['other_majority'] for e in base),
    }
    out['vs_vanilla'] = {
        'part1_no_harm': all(e['no_harm'] for e in van),
        'part3_judges': sum(e['head_majority'] for e in van) >= briefs_required and not any(e['other_majority'] for e in van),
    }
    out['briefs_scored'] = n
    out['verdict'] = ('not decidable: only %d of %d briefs scored' % (n, total_briefs)) if n < total_briefs else (
        'ship' if all(out['vs_base'].values()) and all(out['vs_vanilla'].values()) else 'do not ship')
    return out

if __name__ == '__main__':
    {'prepare': prepare, 'render': render, 'score': score}[sys.argv[1]](sys.argv[2])

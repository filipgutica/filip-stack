# Writing probe scorer. Usage:
#   probe.py render <run-dir>   write scoring prompts and the blind judge ledger
#   probe.py score <run-dir>    compute measures and the decision rule
# <run-dir> holds ledger.json, factsheet-<brief>.md, builds/<build>.md, and, after
# the scoring calls, extract/<build>.json, comp/<build>.json, judges/<pair>-<judge>.json.
import json, os, random, re, secrets, subprocess, sys
from prompts import EXTRACTOR, COMPREHENSION, JUDGE

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.environ.get('PROBE_TOOLS', os.path.join(HERE, 'tools'))
BRIEFS = {'B1': 'Write the landing page copy for `portlog`, following the tool page section order.'}
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

def render(run):
    key = load(f'{HERE}/key.json')
    ledger = load(f'{run}/ledger.json')
    os.makedirs(f'{run}/prompts', exist_ok=True)
    judge_ledger = []
    for b in ledger:
        k = key[b['brief']]
        page = open(f"{run}/builds/{b['build']}.md").read().strip()
        facts = open(f"{run}/factsheet-{b['brief']}.md").read().strip()
        nfacts = len(k['facts']) + len(k['agentOnly'])
        open(f"{run}/prompts/extract-{b['build']}.txt", 'w').write(
            EXTRACTOR.format(brief=BRIEFS[b['brief']], facts=facts, page=page, nfacts=nfacts))
        open(f"{run}/prompts/comp-{b['build']}.txt", 'w').write(COMPREHENSION.format(page=page, **k['questions']))
    by = {(b['brief'], b['attempt'], b['arm']): b for b in ledger}
    for (brief, attempt, arm), head in by.items():
        if arm != 'head':
            continue
        for other in ('base', 'vanilla'):
            o = by.get((brief, attempt, other))
            if not o:
                continue
            pair = secrets.token_hex(4)
            a, b = random.sample([head, o], 2)
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

def start_offset(md):
    m = re.search(r'```|`(?:brew|portlog)\b[^`]*`', md)
    words = len(md.split())
    return round(len(md[:m.start()].split()) / words, 3) if m else 1.0

def tool_row(script, path):
    out = subprocess.run(['python3', '-I', f'{TOOLS}/{script}', f'{TOOLS}/vtext.py', path],
                         capture_output=True, text=True, check=True).stdout.strip().split('\n')
    head, row = out[0].split(), out[1].split()
    return dict(zip(head[1:], map(float, row[-len(head) + 1:])))

def grade(answer, rule):
    a = answer.lower()
    if 'prefix' in rule:
        return a.strip().startswith(rule['prefix'])
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
        'M5': start_offset(md),
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
                agg[f'{brief}/{arm}'] = {m: (round(sum(r[m] for r in rows) / len(rows), 3) if m == 'M1' else round(sum(r[m] for r in rows), 3))
                                         for m in ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'words']}
    rule = decision(agg, votes)
    dump(f'{run}/scores.json', {'builds': builds, 'votes': votes, 'aggregate': agg, 'rule': rule})
    print(json.dumps({'aggregate': agg, 'rule': rule}, indent=1))

def better(m, h, o):
    return h < o if m in LOWER else h > o

def decision(agg, votes, briefs_required=3, total_briefs=4):
    out = {'per_brief': {}}
    for brief in sorted({k.split('/')[0] for k in agg}):
        h, entry = agg.get(f'{brief}/head'), {}
        for other in ('base', 'vanilla'):
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
    {'render': render, 'score': score}[sys.argv[1]](sys.argv[2])

# Bounds the decision rule when scoring calls failed and could not be retried. The frozen
# scorer cannot parse a failed reply, so this script reuses its functions, leaves each
# failed cell's measures unknown, and applies the rule twice: once with every unknown value
# set to favour head and once set to favour the other arm. The rule is monotone in each
# measure, so if both runs give the same verdict, the missing cells cannot change it.
# Usage: partial.py <run-dir>
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'scorer'))
import probe  # noqa: E402

FROM_EXTRACT = ['M1', 'M2', 'M3', 'M4', 'M6']
FROM_COMP = ['M9']

def failed(path):
    try:
        probe.reply_json(path)
        return False
    except (AttributeError, json.JSONDecodeError):
        return True

def extremes(key, brief):
    """(worst, best) value of each extractor or comprehension measure for one page."""
    k = key[brief]
    return {'M1': (0, 1), 'M2': (99, 0), 'M3': (len(k['agentOnly']), 0), 'M4': (0, 1),
            'M6': (1, 0), 'M9': (0, len(k['questions']))}

def builds_with_unknowns(run, key):
    rows, missing = [], []
    for b in probe.load(f'{run}/ledger.json'):
        ex_bad = failed(f"{run}/extract/{b['build']}.json")
        comp_bad = failed(f"{run}/comp/{b['build']}.json")
        if not (ex_bad or comp_bad):
            rows.append(probe.per_build(run, b, key))
            continue
        # Score the page-only measures, then mark the measures the failed calls own.
        stub = {'facts': [], 'invented_claims': [], 'opening': {}, 'fragments': [], 'sentences': 1}
        real_reply = probe.reply_json
        def reply(path, b=b, ex_bad=ex_bad, comp_bad=comp_bad):
            bad = (ex_bad and '/extract/' in path) or (comp_bad and '/comp/' in path)
            return stub if bad else real_reply(path)
        probe.reply_json = reply
        try:
            row = probe.per_build(run, b, key)
        finally:
            probe.reply_json = real_reply
        unknown = (FROM_EXTRACT if ex_bad else []) + (FROM_COMP if comp_bad else [])
        row['unknown'] = unknown
        missing.append({'build': b['build'], 'brief': b['brief'], 'arm': b['arm'],
                        'attempt': b.get('attempt'), 'unknown': unknown})
        rows.append(row)
    return rows, missing

def fill(rows, key, favour_head):
    out = []
    for r in rows:
        r = dict(r)
        for m in r.get('unknown', []):
            worst, best = extremes(key, r['brief'])[m]
            good_for_head = best if r['arm'] == 'head' else worst
            bad_for_head = worst if r['arm'] == 'head' else best
            r[m] = good_for_head if favour_head else bad_for_head
        out.append(r)
    return out

def aggregate(rows):
    agg = {}
    for brief in sorted({b['brief'] for b in rows}):
        for arm in ('vanilla', 'base', 'head'):
            sel = [b for b in rows if b['brief'] == brief and b['arm'] == arm]
            agg[f'{brief}/{arm}'] = {m: probe.aggregate(m, [r[m] for r in sel])
                                     for m in ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'words']}
    return agg

def votes(run):
    out = []
    for p in probe.load(f'{run}/judge-ledger.json'):
        for j in probe.JUDGES:
            r = probe.reply_json(f"{run}/judges/{p['pair']}-{j}.json")
            arm = lambda v: p[v] if v in ('A', 'B') else 'SAME'
            out.append({**p, 'judge': j, **{q: arm(r.get(q)) for q in ('reader', 'careful', 'overall')}})
    return out

def main(run):
    key = probe.load(f'{HERE}/scorer/key.json')
    rows, missing = builds_with_unknowns(run, key)
    v = votes(run)
    result = {'missing': missing, 'votes_counted': len(v)}
    for label, favour in (('favour_head', True), ('favour_other', False)):
        agg = aggregate(fill(rows, key, favour))
        result[label] = {'aggregate': agg, 'rule': probe.decision(agg, v)}
    result['verdict_fixed'] = result['favour_head']['rule']['verdict'] == result['favour_other']['rule']['verdict']
    probe.dump(f'{run}/partial-scores.json', result)
    print(json.dumps({'missing': missing, 'verdict_fixed': result['verdict_fixed'],
                      **{k: result[k]['rule']['verdict'] for k in ('favour_head', 'favour_other')}}, indent=1))

if __name__ == '__main__':
    main(os.path.join(HERE, sys.argv[1]))

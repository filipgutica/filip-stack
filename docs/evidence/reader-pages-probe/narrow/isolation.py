# Isolation check from saved traces. A build may read only its prompt file and its arm
# file; a scoring call may read only its prompt file. Prints one line per violation and
# a summary, never reply text. Usage: isolation.py <run>
import json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
QUIET = {'user_message', 'assistant_message', 'reasoning', 'checkpoint'}

def actions(trace):
    """Each tool or command item, as (type, the text that names what it touched)."""
    for i in trace['items']:
        if i['_type'] in QUIET:
            continue
        yield i['_type'], json.dumps({k: i.get(k) for k in ('title', 'input')})

def check(run):
    run = HERE / run
    ledger = {b['build']: b for b in json.loads((run / 'ledger.json').read_text())}
    report = {'calls': 0, 'actions': 0, 'violations': [], 'reads_per_call': {}}
    for j in json.loads((run / 'calls.json').read_text()):
        r = j['runs'][-1] if j['runs'] else None
        if not r or r.get('state') != 'saved':
            continue
        trace = json.loads((run / 'traces' / f"{j['cell']}-{r['attempt']}.json").read_text())
        allowed = [j['pointer']] + ([ledger[j['cell'][len('build-'):]]['file']] if j['kind'] == 'build' else [])
        acts = list(actions(trace))
        report['calls'] += 1
        report['actions'] += len(acts)
        report['reads_per_call'][len(acts)] = report['reads_per_call'].get(len(acts), 0) + 1
        for kind, text in acts:
            named = [a for a in allowed if a in text]
            if len(named) != 1:
                report['violations'].append({'cell': j['cell'], 'type': kind, 'action': text[:300]})
        for a in allowed:
            if not any(a in t for _, t in acts):
                report['violations'].append({'cell': j['cell'], 'missing_read': a})
    report['reads_per_call'] = {str(k): v for k, v in sorted(report['reads_per_call'].items())}
    (run / 'isolation-check.json').write_text(json.dumps(report, indent=1) + '\n')
    print(json.dumps({k: v if k != 'violations' else len(v) for k, v in report.items()}))
    for v in report['violations'][:20]:
        print(json.dumps(v))

if __name__ == '__main__':
    check(sys.argv[1])

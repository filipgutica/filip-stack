"""Validate saved cells, dispatch settings, input hashes, and trace isolation."""
import collections, hashlib, json, pathlib, re
RUN = pathlib.Path(__file__).resolve().parent
SCORER = RUN.parent / 'scorer'
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
jobs = load(RUN / 'calls.json')
ledger = load(RUN / 'ledger.json')
manifest = load(RUN / 'arm-manifest.json')
assert len(jobs) == len({j['cell'] for j in jobs}) == 46
assert len(ledger) == 15
assert collections.Counter(b['arm'] for b in ledger) == dict(head=5, base=5, vanilla=5)
assert manifest['scorer_sha256'] == load(RUN.parent / 'paid-run/arm-manifest.json')['scorer_sha256']
assert all(sha(SCORER / p) == v for p, v in manifest['scorer_sha256'].items())
assert all(sha(RUN / 'arms' / p) == v['sha256'] for p, v in manifest['arms'].items())
reused = load(RUN / 'reused.json')
assert all(sha(RUN / p) == v['sha256'] == sha(RUN.parent / v['source']) for p, v in reused.items())
reads, events = [], []
for j in jobs:
    assert pathlib.Path(j['reply']).is_file()
    assert j['runs'][-1]['state'] == 'saved'
    assert len(j['runs']) == 1
    run = j['runs'][0]
    dispatch = load(RUN / 'dispatch' / (j['cell'] + '-1.json'))
    assert dispatch['model'] == j['target']['model']
    assert {o['id']:o['value'] for o in dispatch['options']} == j['target']['options']
    assert dispatch['providerInstanceId'] == j['target']['driverKind']
    trace = load(RUN / 'traces' / (j['cell'] + '-1.json'))
    assert not trace['hasMore']
    assert trace['recentRuns'][-1]['status'] == 'completed'
    prompts = [i for i in trace['items'] if i['type'] == 'user_message']
    assert len(prompts) == 1
    assert prompts[0]['text'].strip() == pathlib.Path(j['prompt']).read_text().strip()
    commands = [i['text'] for i in trace['items'] if i['type'] == 'command_execution']
    if j['kind'] == 'build':
        b = next(b for b in ledger if j['cell'] == 'build-' + b['build'])
        assert sha(pathlib.Path(b['file'])) == manifest['arms']['head.md']['sha256']
        assert commands
        lines = [c.splitlines()[0] for c in commands]
        assert all(re.fullmatch(r"\$ /bin/zsh -c 'cat " + re.escape(b['file']) + "'", line) for line in lines), lines
        reads.append(dict(build=b['build'], assigned_file=b['file'], reads=len(commands), commands=lines))
    else:
        assert not commands
        reply = pathlib.Path(j['reply']).read_text()
        value = json.loads(re.search(r'\{[\s\S]*\}', reply).group(0))
        if j['kind'] in ('extract', 'extract2'):
            assert {str(f['id']) for f in value['facts']} == set(map(str, range(1, 9)))
            assert all(isinstance(f['present'], bool) for f in value['facts'])
            assert all(f['where'] in ('explanation','sources_note','link','disclosure','effect_only','absent') for f in value['facts'])
            assert {'invented_claims','opening','sentences','fragments'} <= value.keys()
            assert {'names_subject_and_job','reason_within_first_120_words'} <= value['opening'].keys()
        elif j['kind'] == 'comp':
            assert set(value) >= {'a','b','c'}
        else:
            assert all(value[q] in ('A','B','SAME') for q in ('reader','careful','overall'))
    events.extend([(run['startedAt'], 1), (run['completedAt'], -1)])
scores = load(RUN / 'scores.json')
old_scores = load(RUN.parent / 'paid-run/scores.json')
assert all(scores['aggregate']['B3/' + arm] == old_scores['aggregate']['B3/' + arm] for arm in ('base', 'vanilla'))
pairs = load(RUN / 'judge-ledger.json')
assert len(pairs) == 10
assert sum(p['A'] == 'head' for p in pairs) == 5
assert all(p['A'] == ('head' if (p['attempt'] + ['head-vs-base','head-vs-vanilla'].index(p['pairing'])) % 2 == 0 else p['pairing'].removeprefix('head-vs-')) for p in pairs)
assert len(list((RUN / 'judges').glob('*.json'))) == 30
active = maximum = 0
for _, delta in sorted(events):
    active += delta
    maximum = max(active, maximum)
assert maximum <= 8 and active == 0
result = dict(cells=46, saved=46, by_kind=dict(collections.Counter(j['kind'] for j in jobs)), by_model=dict(collections.Counter(j['target']['model'] for j in jobs)), retries=0, max_running=maximum, reused_files=len(reused), frozen_inputs_match=True, all_effective_settings_match=True, all_task_texts_match=True, build_reads=reads, scoring_traces_without_commands=41, all_scoring_json_valid=True, complete_judge_pairs=10, head_as_A=5, reused_control_metrics_match=True)
(RUN / 'validation.json').write_text(json.dumps(result, indent=1) + '\n')
print(json.dumps(result, indent=1))

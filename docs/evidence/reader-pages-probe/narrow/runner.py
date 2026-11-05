# Bookkeeping for the narrowed reader-pages study. The parent agent makes each
# delegate_task call itself; this script prepares the calls, checks them, and saves
# replies and traces from the T3 state database (read-only) without printing them.
#   runner.py init <run> [paid]   build arms, ledger, build prompts and pointer files
#   runner.py scoring <run> [base-only]  render scoring prompts once and add their calls
#   runner.py supersede dry-run <cell>   set aside a dry-run reply so that cell runs again
#   runner.py next <run>          mark up to 8 minus running calls as dispatching; print them
#   runner.py wait <run> [secs] [n]  block until n running calls finish; save replies and traces
#   runner.py status <run>
import hashlib, json, os, pathlib, secrets, sqlite3, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SCORER = HERE / 'scorer'
DB = pathlib.Path.home() / '.t3-workbench/userdata/statev2.sqlite'
REFS = json.loads((HERE / 'refs.json').read_text())  # pinned in the prereg
MAX_RUNNING = 8
SOL = {'driverKind': 'codex', 'model': 'gpt-6.1-sol', 'options': {'reasoningEffort': 'high', 'serviceTier': 'default'}}
SOL_LOW = {'driverKind': 'codex', 'model': 'gpt-6.1-sol', 'options': {'reasoningEffort': 'low', 'serviceTier': 'default'}}
ASTRA = {'driverKind': 'codex', 'model': 'gpt-6-astra', 'options': {'reasoningEffort': 'high', 'serviceTier': 'default'}}
OPUS = {'driverKind': 'claudeAgent', 'model': 'claude-opus-5-5', 'options': {'effort': 'high', 'fastMode': False}}
TASK = ('Read the file `{path}` and follow its instructions exactly. Read no other file, run no other command, '
        'do not browse, and do not edit files or start subagents. Reply with only the output that file asks for.')
# A build's prompt names its arm file, so the build task allows that one extra read. The
# dry run showed the scoring wording ("read no other file") made one build skip its arm.
BUILD_TASK = ('Read the file `{path}` and follow its instructions exactly, including reading the one file it names. '
              'Read no other file, run no other command, do not browse, and do not edit files or start subagents. '
              'Reply with only the output that file asks for.')
TERMINAL = {'completed', 'failed', 'cancelled', 'interrupted'}

def dump(p, v):
    p.parent.mkdir(parents=True, exist_ok=True)
    t = p.with_suffix(p.suffix + '.tmp'); t.write_text(json.dumps(v, indent=1) + '\n'); t.replace(p)

def pointer(prompt):
    """Copy a prompt alone into a new randomly named folder, so the call reads nothing else."""
    d = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'writing-probe' / ('p-' + secrets.token_hex(4))
    d.mkdir(parents=True, exist_ok=False)
    f = d / (secrets.token_hex(4) + '.txt')
    f.write_bytes(prompt.read_bytes())
    return str(f)

def job(cell, kind, prompt, reply, target):
    return dict(cell=cell, kind=kind, prompt=str(prompt), pointer=pointer(prompt), reply=str(reply), target=target, runs=[])

def init(name, paid):
    run = HERE / name
    assert not (run / 'ledger.json').exists(), 'ledger already exists; resume it'
    (run / 'arms').mkdir(parents=True, exist_ok=True)
    briefs = ['N1', 'N2', 'N3'] if paid else ['N1']
    manifest = {'refs': REFS, 'arms': {}, 'scorer_sha256': {str(p.relative_to(SCORER)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(SCORER.rglob('*')) if p.is_file() and '__pycache__' not in str(p)}}
    # N1 is the tool landing page, so its arms add the Pages site section, as B1's did.
    for arm in ['vanilla', 'base', 'head']:
        for n1 in ([True, False] if paid else [True]):
            key = arm + ('-n1' if n1 else '')
            p = run / 'arms' / f'{key}.md'
            if arm == 'vanilla':
                p.write_text('')
            else:
                subprocess.run(['python3', '-B', str(SCORER / 'build_arms.py'), REFS[arm], str(p)] + (['--b1'] if n1 else []), cwd=ROOT, check=True)
            manifest['arms'][key] = {'words': len(p.read_text().split()), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    dump(run / 'arm-manifest.json', manifest)
    ledger = []
    for brief in briefs:
        for attempt in range(1, 6 if paid else 2):
            for arm in ['vanilla', 'base', 'head']:
                folder = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'writing-probe' / ('g-' + secrets.token_hex(4))
                folder.mkdir(parents=True, exist_ok=False)
                f = folder / (secrets.token_hex(4) + '.md')
                f.write_bytes((run / 'arms' / f"{arm}{'-n1' if brief == 'N1' else ''}.md").read_bytes())
                ledger.append(dict(build=secrets.token_hex(4), brief=brief, attempt=attempt, arm=arm, file=str(f)))
    dump(run / 'ledger.json', ledger)
    subprocess.run(['python3', '-B', str(SCORER / 'probe.py'), 'prepare', str(run)], check=True)
    dump(run / 'calls.json', [job('build-' + b['build'], 'build', run / 'prompts' / f"build-{b['build']}.txt",
                                  run / 'builds' / f"{b['build']}.md", SOL) for b in ledger])
    print(json.dumps({'arms': manifest['arms'], 'builds': len(ledger)}, indent=1))

def scoring(name, base_only=False):
    run = HERE / name
    jobs = json.loads((run / 'calls.json').read_text())
    assert all(pathlib.Path(j['reply']).is_file() for j in jobs if j['kind'] == 'build'), 'builds incomplete'
    assert not (run / 'judge-ledger.json').exists(), 'already rendered: do not regenerate pair ids'
    subprocess.run(['python3', '-B', str(SCORER / 'probe.py'), 'render', str(run)], check=True)
    for b in json.loads((run / 'ledger.json').read_text()):
        jobs.append(job('extract-' + b['build'], 'extract', run / 'prompts' / f"extract-{b['build']}.txt", run / 'extract' / f"{b['build']}.json", SOL))
        jobs.append(job('comp-' + b['build'], 'comp', run / 'prompts' / f"comp-{b['build']}.txt", run / 'comp' / f"{b['build']}.json", SOL_LOW))
    for b in json.loads((run / 'double-code.json').read_text()):
        jobs.append(job('extract2-' + b, 'extract2', run / 'prompts' / f'extract-{b}.txt', run / 'extract2' / f'{b}.json', ASTRA))
    for p in json.loads((run / 'judge-ledger.json').read_text()):
        if base_only and p['pairing'] != 'head-vs-base':
            continue  # The dry run judges only the head-base pair, to keep the run within budget.
        for judge, target in [('astra', ASTRA), ('sol', SOL), ('opus', OPUS)]:
            jobs.append(job(f"judge-{p['pair']}-{judge}", 'judge', run / 'prompts' / f"judge-{p['pair']}.txt", run / 'judges' / f"{p['pair']}-{judge}.json", target))
    dump(run / 'calls.json', jobs)
    print(json.dumps({'jobs': len(jobs)}))

def saved(j):
    return pathlib.Path(j['reply']).is_file()

def running(jobs):
    return [j for j in jobs if j['runs'] and j['runs'][-1]['state'] == 'dispatching' and not saved(j)]

def next_calls(name):
    run = HERE / name
    jobs = json.loads((run / 'calls.json').read_text())
    if any(j['runs'] and j['runs'][-1]['state'] == 'failed' for j in jobs):
        sys.exit('STOP: a call failed; the budget allows no retry')
    free = MAX_RUNNING - len(running(jobs))
    batch = [j for j in jobs if (not j['runs'] or j['runs'][-1]['state'] == 'superseded') and not saved(j)][:max(0, free)]
    ids = {r['clientRequestId'] for j in jobs for r in j['runs']}
    out = []
    for j in batch:
        n = len(j['runs']) + 1
        req = f"rp-narrow-{name}-{j['cell']}-{n}"
        assert req not in ids and j['target'] in (SOL, SOL_LOW, ASTRA, OPUS) and pathlib.Path(j['pointer']).is_file()
        assert pathlib.Path(j['pointer']).read_bytes() == pathlib.Path(j['prompt']).read_bytes()
        j['runs'].append({'attempt': n, 'state': 'dispatching', 'clientRequestId': req, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
        task = (BUILD_TASK if j['kind'] == 'build' else TASK).format(path=j['pointer'])
        out.append({'clientRequestId': req, 'title': f'rp-narrow {name} {j["cell"]}', 'target': j['target'], 'task': task})
    dump(run / 'calls.json', jobs)
    for o in out:
        print(json.dumps(o, separators=(',', ':')))

def supersede(name, cell):
    """Dry run only: set aside a saved reply made under a broken pipeline so the cell runs again."""
    assert name == 'dry-run', 'paid cells are never rerun'
    run = HERE / name
    jobs = json.loads((run / 'calls.json').read_text())
    j = next(j for j in jobs if j['cell'] == cell)
    reply = pathlib.Path(j['reply'])
    (run / 'superseded').mkdir(exist_ok=True)
    reply.rename(run / 'superseded' / reply.name)
    j['runs'][-1]['state'] = 'superseded'
    dump(run / 'calls.json', jobs)

def db():
    return sqlite3.connect(f'file:{DB}?mode=ro', uri=True)

def lookup(con, req):
    """The run row for a client request id, or None before the server records it."""
    return con.execute("select thread_id, run_id, status from orchestration_v2_projection_runs where thread_id like ? order by ordinal desc limit 1",
                       ('%delegate-task%3A' + req,)).fetchone()

def capture(con, run, j):
    r = j['runs'][-1]
    row = lookup(con, r['clientRequestId'])
    if not row or row[2] not in TERMINAL:
        return None
    thread, run_id, status = row
    items = [json.loads(p) | {'_type': t} for t, p in con.execute(
        "select type, payload_json from orchestration_v2_projection_turn_items where thread_id=? order by ordinal", (thread,))]
    dump(run / 'traces' / f"{j['cell']}-{r['attempt']}.json", {'threadId': thread, 'runId': run_id, 'status': status, 'items': items})
    r.update(threadId=thread, runId=run_id, status=status, completedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
    replies = [i for i in items if i['_type'] == 'assistant_message' and i.get('text')]
    if status == 'completed' and replies:
        pathlib.Path(j['reply']).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(j['reply']).write_text(replies[-1]['text'] + '\n')
        r['state'] = 'saved'
    else:
        r['state'] = 'failed'
    return r['state']

def wait(name, secs=540, enough=1):
    """Return once `enough` running calls have finished (or all of them), or at the deadline."""
    run = HERE / name
    deadline = time.time() + secs
    total_done = []
    while True:
        jobs = json.loads((run / 'calls.json').read_text())
        active = running(jobs)
        con = db()
        done = [(j['cell'], capture(con, run, j)) for j in active]
        con.close()
        done = [d for d in done if d[1]]
        if done:
            dump(run / 'calls.json', jobs)
        total_done += done
        left = len(running(jobs))
        if len(total_done) >= enough or not left or time.time() > deadline:
            print(json.dumps({'captured': len(total_done), 'failed': [c for c, s in total_done if s == 'failed'], 'running': left,
                              'saved': sum(saved(j) for j in jobs), 'total': len(jobs)}))
            return
        time.sleep(15)

def status(name):
    jobs = json.loads((HERE / name / 'calls.json').read_text())
    print(json.dumps({'total': len(jobs), 'saved': sum(saved(j) for j in jobs), 'running': len(running(jobs)),
                      'unstarted': sum(not j['runs'] for j in jobs)}))

if __name__ == '__main__':
    cmd, name = sys.argv[1], sys.argv[2]
    if cmd == 'init': init(name, len(sys.argv) > 3 and sys.argv[3] == 'paid')
    elif cmd == 'scoring': scoring(name, len(sys.argv) > 3 and sys.argv[3] == 'base-only')
    elif cmd == 'supersede': supersede(name, sys.argv[3])
    elif cmd == 'next': next_calls(name)
    elif cmd == 'wait': wait(name, int(sys.argv[3]) if len(sys.argv) > 3 else 540, int(sys.argv[4]) if len(sys.argv) > 4 else 1)
    elif cmd == 'status': status(name)

"""B3-only rerun. Reuse paid controls; never regenerate ledgers on resume."""
import hashlib, importlib.util, json, os, pathlib, secrets, shutil, subprocess, sys
ROOT = pathlib.Path('/Users/filip.gutica/code/worktrees/rp-probe')
EVIDENCE = ROOT / 'docs/evidence/reader-pages-probe'
OLD = EVIDENCE / 'paid-run'
RUN = EVIDENCE / 'b3-rerun'
SCORER = EVIDENCE / 'scorer'
sys.path.insert(0, str(SCORER))
import probe
spec = importlib.util.spec_from_file_location('paid_runner', OLD / 'runner.py')
paid = importlib.util.module_from_spec(spec)
argv = sys.argv
sys.argv = [argv[0], "library"]
try:
    spec.loader.exec_module(paid)
finally:
    sys.argv = argv
dump, job, SOL = paid.dump, paid.job, paid.SOL
ASTRA = dict(driverKind='codex', model='gpt-6-astra', options=dict(reasoningEffort='high', serviceTier='default'))
OPUS = dict(driverKind='claudeAgent', model='claude-opus-5-5', options=dict(effort='high', fastMode=False))

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def init():
    assert not (RUN / 'ledger.json').exists(), 'Resume saved ledger; do not reinitialize'
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    (RUN / 'arms').mkdir(exist_ok=True)
    subprocess.run(['python3', '-B', str(SCORER / 'build_arms.py'), head, str(RUN / 'arms/head.md')], cwd=ROOT, check=True)
    for arm in ('base', 'vanilla'):
        shutil.copy2(OLD / f'arms/{arm}.md', RUN / f'arms/{arm}.md')
    ledger, reused = [], {}
    for old in probe.load(OLD / 'ledger.json'):
        if old['brief'] != 'B3':
            continue
        b = dict(old)
        if b['arm'] == 'head':
            b['build'] = secrets.token_hex(4)
            folder = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'writing-probe' / ('g-' + secrets.token_hex(4))
            folder.mkdir(parents=True, exist_ok=False)
            f = folder / (secrets.token_hex(4) + '.md')
            f.write_bytes((RUN / 'arms/head.md').read_bytes())
            b['file'] = str(f)
        else:
            for kind, ext in [('builds', 'md'), ('extract', 'json'), ('comp', 'json'), ('extract2', 'json')]:
                src = OLD / kind / f"{b['build']}.{ext}"
                if src.exists():
                    dst = RUN / kind / src.name
                    dst.parent.mkdir(exist_ok=True)
                    shutil.copy2(src, dst)
                    reused[str(dst.relative_to(RUN))] = dict(source=str(src.relative_to(EVIDENCE)), sha256=sha(src))
        ledger.append(b)
    dump(RUN / 'ledger.json', ledger)
    dump(RUN / 'reused.json', reused)
    manifest = dict(head=head, control_refs=probe.load(OLD / 'arm-manifest.json')['refs'], arms={p.name:dict(words=len(p.read_text().split()), sha256=sha(p)) for p in (RUN / 'arms').iterdir()}, scorer_sha256={str(p.relative_to(SCORER)):sha(p) for p in SCORER.rglob('*') if p.is_file() and '__pycache__' not in str(p)})
    dump(RUN / 'arm-manifest.json', manifest)
    probe.prepare(str(RUN))
    dump(RUN / 'calls.json', [job('build-' + b['build'], 'build', RUN / f"prompts/build-{b['build']}.txt", RUN / f"builds/{b['build']}.md") for b in ledger if b['arm'] == 'head'])
    print(json.dumps(manifest, indent=1))

def render():
    assert not (RUN / 'judge-ledger.json').exists(), 'Already rendered: resume calls.json'
    ledger = probe.load(RUN / 'ledger.json')
    assert all((RUN / f"builds/{b['build']}.md").is_file() for b in ledger)
    probe.render(str(RUN))
    jobs = probe.load(RUN / 'calls.json')
    for b in ledger:
        if b['arm'] != 'head':
            continue
        for kind in ('extract', 'comp'):
            target = json.loads(json.dumps(SOL))
            if kind == 'comp':
                target['options']['reasoningEffort'] = 'low'
            jobs.append(job(kind + '-' + b['build'], kind, RUN / f"prompts/{kind}-{b['build']}.txt", RUN / f"{kind}/{b['build']}.json", target))
    for build in probe.load(RUN / 'double-code.json'):
        if not (RUN / f'extract2/{build}.json').exists():
            jobs.append(job('extract2-' + build, 'extract2', RUN / f'prompts/extract-{build}.txt', RUN / f'extract2/{build}.json', ASTRA))
    for pair in probe.load(RUN / 'judge-ledger.json'):
        for judge, target in [('astra', ASTRA), ('sol', SOL), ('opus', OPUS)]:
            jobs.append(job(f"judge-{pair['pair']}-{judge}", 'judge', RUN / f"prompts/judge-{pair['pair']}.txt", RUN / f"judges/{pair['pair']}-{judge}.json", target))
    assert len(jobs) == 46
    dump(RUN / 'calls.json', jobs)
    print(json.dumps(dict(calls=len(jobs), double_code=probe.load(RUN / 'double-code.json'))))

def combine():
    probe.score(str(RUN))
    old, new = probe.load(OLD / 'scores.json'), probe.load(RUN / 'scores.json')
    agg = {**{k:v for k,v in old['aggregate'].items() if not k.startswith('B3/')}, **new['aggregate']}
    votes = [v for v in old['votes'] if v['brief'] != 'B3'] + new['votes']
    result = dict(aggregate=agg, votes=votes, rule=probe.decision(agg, votes), note='B1, B2, B4 reused; regression under revised guidance untested')
    dump(RUN / 'combined-scores.json', result)
    print(json.dumps(result['rule'], indent=1))

if __name__ == '__main__':
    {'init':init, 'render':render, 'combine':combine}[sys.argv[1]]()

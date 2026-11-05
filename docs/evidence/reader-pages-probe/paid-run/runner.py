import json, os, pathlib, secrets, subprocess, sys, hashlib
ROOT=pathlib.Path('/Users/filip.gutica/code/worktrees/rp-probe')
SCORER=ROOT/'docs/evidence/reader-pages-probe/scorer'
RUNS=ROOT/'docs/evidence/reader-pages-probe'
SOL={'driverKind':'codex','model':'gpt-6.1-sol','options':{'reasoningEffort':'high','serviceTier':'default'}}
def dump(p,v):
    p.parent.mkdir(parents=True,exist_ok=True); t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(v,indent=1)+'\n');t.replace(p)
def job(cell,kind,prompt,reply,target=SOL):
    return dict(cell=cell,kind=kind,prompt=str(prompt),reply=str(reply),target=target,runs=[])
def init(name,paid):
    run=RUNS/name
    assert not (run/'ledger.json').exists(), 'ledger already exists; resume it'
    (run/'arms').mkdir(parents=True,exist_ok=True)
    refs={k:subprocess.check_output(['git','rev-parse',v],cwd=ROOT,text=True).strip() for k,v in [('base','origin/main'),('head','HEAD')]}
    manifest={'refs':refs,'arms':{},'scorer_sha256':{str(p.relative_to(SCORER)):hashlib.sha256(p.read_bytes()).hexdigest() for p in SCORER.rglob('*') if p.is_file() and '__pycache__' not in str(p)}}
    for arm in ['vanilla','base','head']:
        for b1 in ([False,True] if paid else [True]):
            key=arm+('-b1' if paid and b1 else '')
            p=run/'arms'/f'{key}.md'
            if arm=='vanilla': p.write_text('')
            else: subprocess.run(['python3','-B',str(SCORER/'build_arms.py'),refs[arm],str(p)]+(['--b1'] if b1 else []),cwd=ROOT,check=True)
            manifest['arms'][key]={'words':len(p.read_text().split()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    dump(run/'arm-manifest.json',manifest)
    ledger=[]
    for brief in (['B1','B2','B3','B4'] if paid else ['B1']):
        for attempt in range(1,6 if paid else 2):
            for arm in ['vanilla','base','head']:
                build=secrets.token_hex(4)
                folder=pathlib.Path(os.environ.get('TMPDIR','/tmp'))/'writing-probe'/('g-'+secrets.token_hex(4))
                folder.mkdir(parents=True,exist_ok=False)
                f=folder/(secrets.token_hex(4)+'.md')
                armkey=arm+('-b1' if paid and brief=='B1' else '')
                f.write_bytes((run/'arms'/f'{armkey}.md').read_bytes())
                ledger.append(dict(build=build,brief=brief,attempt=attempt,arm=arm,file=str(f)))
    dump(run/'ledger.json',ledger)
    subprocess.run(['python3','-B',str(SCORER/'probe.py'),'prepare',str(run)],check=True)
    jobs=[job('build-'+b['build'],'build',run/'prompts'/f"build-{b['build']}.txt",run/'builds'/f"{b['build']}.md") for b in ledger]
    dump(run/'calls.json',jobs)
    print(json.dumps(manifest,indent=1))
def scoring(name):
    run=RUNS/name; jobs=json.loads((run/'calls.json').read_text())
    assert all(pathlib.Path(j['reply']).is_file() for j in jobs if j['kind']=='build')
    assert not (run/'judge-ledger.json').exists(), 'already rendered: do not regenerate pair ids'
    subprocess.run(['python3','-B',str(SCORER/'probe.py'),'render',str(run)],check=True)
    for b in json.loads((run/'ledger.json').read_text()):
        for kind in ['extract','comp']:
            target=json.loads(json.dumps(SOL))
            if kind=='comp':target['options']['reasoningEffort']='low'
            jobs.append(job(kind+'-'+b['build'],kind,run/'prompts'/f"{kind}-{b['build']}.txt",run/kind/f"{b['build']}.json",target))
    astra={'driverKind':'codex','model':'gpt-6-astra','options':{'reasoningEffort':'high','serviceTier':'default'}}
    for b in json.loads((run/'double-code.json').read_text()):
        jobs.append(job('extract2-'+b,'extract2',run/'prompts'/f'extract-{b}.txt',run/'extract2'/f'{b}.json',astra))
    for p in json.loads((run/'judge-ledger.json').read_text()):
        for judge,target in [('astra',astra),('sol',SOL),('opus',{'driverKind':'claudeAgent','model':'claude-opus-5-5','options':{'effort':'high','fastMode':False}})]:
            cell=f"judge-{p['pair']}-{judge}"
            jobs.append(job(cell,'judge',run/'prompts'/f"judge-{p['pair']}.txt",run/'judges'/f"{p['pair']}-{judge}.json",target))
    dump(run/'calls.json',jobs);print(json.dumps({'jobs':len(jobs)}))
def status(name):
    run=RUNS/name;jobs=json.loads((run/'calls.json').read_text())
    print(json.dumps({'total':len(jobs),'saved':sum(pathlib.Path(j['reply']).is_file() for j in jobs),'active':[{'cell':j['cell'],**j['runs'][-1]} for j in jobs if j['runs'] and j['runs'][-1]['state']=='running' and not pathlib.Path(j['reply']).is_file()],'unstarted':sum(not j['runs'] and not pathlib.Path(j['reply']).is_file() for j in jobs)},indent=1))
if sys.argv[1]=='init':init(sys.argv[2],len(sys.argv)>3 and sys.argv[3]=='paid')
elif sys.argv[1]=='scoring':scoring(sys.argv[2])
elif sys.argv[1]=='status':status(sys.argv[2])

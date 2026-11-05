
const ROOT='/Users/filip.gutica/code/worktrees/rp-probe/docs/evidence/reader-pages-probe';
const quote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
const cmd=async c=>{const r=await tools.exec_command({cmd:c,max_output_tokens:30000});if(r.exit_code!==0)throw Error(r.output);return r.output;};
const read=async p=>JSON.parse(await cmd('cat '+quote(p)));
const write=async(p,v)=>await cmd("python3 -c "+quote("import pathlib,sys; p=pathlib.Path(sys.argv[1]); p.parent.mkdir(parents=True,exist_ok=True); t=p.with_suffix(p.suffix+'.tmp'); t.write_text(sys.argv[2]); t.replace(p)")+' '+quote(p)+' '+quote(typeof v==='string'?v:JSON.stringify(v,null,1)+'\n'));
const structured=r=>r.structuredContent??JSON.parse(r.content.find(c=>c.type==='text').text);
const getJobs=async(file,cells)=>JSON.parse(await cmd('python3 -c '+quote("import json,sys,pathlib; jobs=json.load(open(sys.argv[1])); cells=json.loads(sys.argv[2]); active=sum(bool(j['runs']) and j['runs'][-1]['state']=='running' for j in jobs); selected=[j for j in jobs if j['cell'] in cells] if cells is not None else [j for j in jobs if (not j['runs'] or j['runs'][-1]['state']=='retry') and not pathlib.Path(j['reply']).is_file()][:8-active]; print(json.dumps(selected,separators=(',',':')))")+' '+quote(file)+' '+quote(JSON.stringify(cells))));
const updateJob=async(file,job)=>await cmd('python3 -c '+quote("import json,sys,pathlib; p=pathlib.Path(sys.argv[1]); jobs=json.loads(p.read_text()); job=json.loads(sys.argv[2]); jobs=[job if j['cell']==job['cell'] else j for j in jobs]; t=p.with_suffix('.json.tmp'); t.write_text(json.dumps(jobs,indent=1)); t.replace(p)")+' '+quote(file)+' '+quote(JSON.stringify(job)));
async function launch(name){
 const file=ROOT+'/'+name+'/calls.json'; const jobs=await getJobs(file,null);
 for(const j of jobs){
  const prompt=await cmd('cat '+quote(j.prompt));
  const n=j.runs.length+1; const req='rp-probe-'+name+'-'+j.cell+'-'+n;
  j.runs.push({attempt:n,state:'dispatching',clientRequestId:req,startedAt:new Date().toISOString()});await updateJob(file,j);
  const r=structured(await tools.mcp__t3_code__delegate_task({clientRequestId:req,mode:'async',role:'general',isolation:'shared',target:j.target,task:prompt,title:name+' '+j.cell}));
  Object.assign(j.runs.at(-1),{state:'running',taskId:r.taskId,threadId:r.childThreadId,runId:r.childRunId,link:r.link,status:r.status,next:r.next});
  await updateJob(file,j);await write(ROOT+'/'+name+'/dispatch/'+j.cell+'-'+n+'.json',r);
  text({cell:j.cell,status:r.status});
 }
}

async function collect(name,cells){
 const file=ROOT+'/'+name+'/calls.json';const jobs=await getJobs(file,cells);
 for(const cell of cells){
  const j=jobs.find(j=>j.cell===cell);if(!j)throw Error('unknown cell '+cell);
  const r=j.runs.at(-1);if(r.state==='saved')continue;
  const data=structured(await tools.mcp__t3_code__t3_thread_read({threadId:r.threadId,view:'activity',limit:100,maxCharsPerItem:50000,runLimit:1}));
  await write(ROOT+'/'+name+'/traces/'+cell+'-'+r.attempt+'.json',data);
  const items=data.items.filter(i=>i.createdBy==='agent'&&i.type==='assistant_message'&&i.text);
  const last=items.at(-1);
  text({cell,status:data.recentRuns.at(-1)?.status,traceItems:data.items.length});
  if(data.hasMore||last?.textTruncated)throw Error('truncated trace or reply');
  const status=data.recentRuns.at(-1)?.status;
  if(status==='completed'&&last){
   await write(j.reply,last.text+'\n');r.state='saved';r.completedAt=new Date().toISOString();r.replyItemId=last.itemId;
  }else if(['failed','cancelled','interrupted'].includes(status)){
   r.state='failed';r.error=status;
   if(j.runs.length===1)r.state='retry';
   else throw Error('retry failed '+cell);
  }else throw Error('not completed '+cell);
  await updateJob(file,j);
 }
}

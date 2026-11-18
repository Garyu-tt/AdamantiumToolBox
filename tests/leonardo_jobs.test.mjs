import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=await mkdtemp(join(tmpdir(),'leonardo-jobs-'));
process.env.LOCALAPPDATA=root;
process.env.ADA_TOKEN='leonardo-tests-are-long-enough-for-auth';
process.env.ADA_CORE_URL='http://127.0.0.1:12345';
const {dispatch,jobStatus,cancelJob}=await import('../apps/leonardo/router.mjs');
const {listJobs,findJob}=await import('../apps/leonardo/jobs.mjs');
const original=globalThis.fetch;
const graph={nodes:[
 {id:'video_engine.provider',type:'resource',provider:{schema:'mas-graphics-provider-1',
  locality:'remote',operations:[{kind:'video',action:'video_engine.submit',
   formats:['video/mp4'],jobs:{statusAction:'video_engine.status',cancelAction:'video_engine.cancel'}}]}},
 ...['submit','status','cancel'].map(n=>({id:'video_engine.'+n,type:'action'}))]};
let enabled=true,operations=[];
globalThis.fetch=async(url,opts={})=>{
 if(url.endsWith('/api/graph'))return new Response(JSON.stringify(enabled?graph:{nodes:[]}),{status:200});
 if(url.endsWith('/api/invoke')){
  const input=JSON.parse(opts.body);operations.push(input);
  const output=input.action==='video_engine.submit'?{status:'queued',jobId:'provider-task-12'}:
   input.action==='video_engine.status'?{status:'running',jobId:'provider-task-12'}:
   input.action==='video_engine.cancel'?{status:'cancelled'}:null;
  return new Response(JSON.stringify({result:output}),{status:200});
 }
 throw Error('unexpected_http');
};
try{
 await assert.rejects(dispatch({kind:'video',prompt:'sky'}),/no_eligible_graphics_provider/);
 const task=await dispatch({kind:'video',prompt:'sky',allowRemote:true});
 assert.equal(task.status,'queued');assert(task.jobId!== 'provider-task-12');
 const stored=await findJob(task.jobId);assert.equal(stored.sourceJobId,'provider-task-12');
 assert.equal((await listJobs()).length,1);
 const status=await jobStatus(task.jobId);
 assert.equal(status.jobId,task.jobId);assert.equal(status.status,'running');
 assert.equal(operations.at(-1).params.jobId,'provider-task-12');
 const canceled=await cancelJob(task.jobId);
 assert.equal(canceled.status,'cancelled');
 enabled=false;
 const missing=await jobStatus(task.jobId);
 assert.equal(missing.status,'provider_unavailable');
 assert.equal(missing.lastKnown,'cancelled');
 await assert.rejects(findJob('../illegal'),/invalid_job_id/);
 console.log('LEONARDO_JOBS_OK remote opt-in queued status cancellation and offline');
}finally{globalThis.fetch=original;await rm(root,{recursive:true,force:true});}

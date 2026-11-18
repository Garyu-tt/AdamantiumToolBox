import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TaskPool} from '../apps/task_pool/store.mjs';
import {execute} from '../apps/orchestrator/engine.mjs';
const root=await mkdtemp(join(tmpdir(),'mas-task-flow-'));
try{
 const pool=new TaskPool(root);await pool.startup();
 const task=await pool.submit({title:'Summarize an incident',requires:['ai.text.generate'],
  payload:{prompt:'Summarize the incident'},idempotencyKey:'incident-test'});
 let calls=0;
 const allowed=new Set(['tasks.claim','claude.start','claude.status','tasks.complete']);
 const result=await execute({steps:[
  {id:'claim',action:'tasks.claim',params:{workerId:'claude-worker-1',capabilities:['ai.text.generate']}},
  {id:'run',action:'claude.start',after:['claim'],params:{prompt:{$step:'claim',path:['payload','prompt']}},
   poll:{action:'claude.status',intervalMs:100,maxAttempts:3}},
  {id:'done',action:'tasks.complete',after:['run'],params:{
   taskId:{$step:'claim',path:['taskId']},workerId:'claude-worker-1',
   token:{$step:'claim',path:['token']},result:{$step:'run',path:['result','content']}}}
 ]},async(id,params)=>{
  calls++;
  if(id==='tasks.claim')return pool.claim(params);
  if(id==='claude.start'){assert.equal(params.prompt,'Summarize the incident');
   return {status:'queued',jobId:'fake-job'};}
  if(id==='claude.status')return {status:'completed',result:{content:'Incident summary'}};
  if(id==='tasks.complete')return pool.transition(params,'completed');
  throw Error('unexpected_action');
 },{allowed});
 assert.equal(result.status,'completed');assert.equal(calls,4);
 assert.equal((await pool.get(task.taskId)).outcome,'Incident summary');
 console.log('TASK_POOL_FLOW_OK queued task -> Claude agent -> durable completed task');
}finally{await rm(root,{recursive:true,force:true});}

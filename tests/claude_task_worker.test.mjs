import {strict as assert} from 'node:assert';
import {selectPool,executeOne} from '../apps/claude/task_worker.mjs';
const actions=['task_pool.claim','task_pool.heartbeat','task_pool.complete','task_pool.fail',
 'claude.start','claude.status'].map(id=>({id,type:'action'}));
const graph={nodes:[...actions,{id:'task_pool.provider',type:'resource',provider:{
 schema:'mas-task-provider-1',claimAction:'task_pool.claim',heartbeatAction:'task_pool.heartbeat',
 completeAction:'task_pool.complete',failAction:'task_pool.fail'}}]};
assert.equal(selectPool({nodes:[]}),null);
assert.equal(selectPool(graph)?.claimAction,'task_pool.claim');
assert.throws(()=>selectPool({nodes:[...graph.nodes,graph.nodes.at(-1)]}),/multiple_task_providers/);
const calls=[];let claimed=false;
const api=async(path,body)=>{
 if(path==='/api/graph')return graph;
 const {action,params}=body;calls.push(action);
 if(action==='task_pool.claim'){
  if(claimed)return {status:'empty'};
  claimed=true;assert.deepEqual(params.capabilities,['ai.text.generate']);
  assert.equal(params.requiresContract,'ai.text.generate');
  return {status:'claimed',taskId:'task-id',token:'lease-token',payload:{prompt:'Analyze alert',tools:true}};
 }
 if(action==='claude.start'){assert.equal(params.prompt,'Analyze alert');assert.equal(params.tools,false);
  return {status:'queued',jobId:'claude-job-id'};}
 if(action==='claude.status')return {status:'completed',result:{content:'Healthy',model:'test-model'}};
 if(action==='task_pool.complete'){assert.equal(params.taskId,'task-id');
  assert.equal(params.token,'lease-token');assert.equal(params.result.content,'Healthy');
  return {status:'completed',taskId:'task-id'};}
 throw Error('unexpected '+action);
};
const params={api,workerId:'test-worker',skills:['ai.text.generate'],pollMs:100,heartbeatMs:1000};
const result=await executeOne(params);
assert.equal(result.status,'completed');assert.equal(calls.at(-1),'task_pool.complete');
assert.equal((await executeOne(params)).status,'empty');
console.log('CLAUDE_TASK_WORKER_OK dynamic task provider, serial claim, no automatic tools, completion');

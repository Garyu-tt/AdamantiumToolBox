import {strict as assert} from 'node:assert';
import {validate,expand,execute} from '../apps/orchestrator/engine.mjs';
const allowed=new Set(['memory.search','claude.start','claude.status','ops.inspect','ops.report']);
assert.throws(()=>validate({steps:[{id:'a',action:'shell.exec'}]},allowed),/step_denied/);
assert.throws(()=>validate({steps:[{id:'a',action:'ops.inspect',after:['b']},
 {id:'b',action:'ops.inspect',after:['a']}]},allowed),/workflow_cycle/);
assert.throws(()=>expand({x:{$step:'missing'}},{ok:1}),/reference_unavailable/);
const running=[];let peak=0,concurrent=0;
const result=await execute({parallelism:2,steps:[
 {id:'memory',action:'memory.search',params:{query:'project'}},
 {id:'server',action:'ops.inspect'},
 {id:'reason',action:'claude.start',after:['memory','server'],
  params:{prompt:{$step:'memory',path:['content']}},poll:{action:'claude.status',intervalMs:100}},
 {id:'report',action:'ops.report',after:['reason'],params:{body:{$step:'reason',path:['result','content']}}}
]},async(action,params)=>{
 concurrent++;peak=Math.max(concurrent,peak);running.push(action);
 await new Promise(resolve=>setTimeout(resolve,25));concurrent--;
 if(action==='memory.search')return {content:'Relevant Noosphere context'};
 if(action==='ops.inspect')return {ok:true};
 if(action==='claude.start'){assert.equal(params.prompt,'Relevant Noosphere context');return {status:'queued',jobId:'test-id'};}
 if(action==='claude.status')return {status:'completed',jobId:'test-id',result:{content:'Recommended fix'}};
 if(action==='ops.report'){assert.equal(params.body,'Recommended fix');return {saved:true};}
 throw Error('unexpected');
},{allowed,parallelism:2});
assert.equal(result.status,'completed');assert(peak<=2);assert(peak>=2);
assert.equal(result.outputs.report.saved,true);assert(running.includes('claude.status'));
const abort=new AbortController();abort.abort();
await assert.rejects(execute({steps:[{id:'a',action:'ops.inspect'}]},async()=>{},
 {allowed,signal:abort.signal}),/cancelled/);
console.log('ORCHESTRATOR_OK generic DAG, memory-to-Claude, async polling, concurrency, policy, cycles');

import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TaskPool} from '../apps/task_pool/store.mjs';
const home=await mkdtemp(join(tmpdir(),'adamantium-tasks-'));
let clock=100000;
const pool=new TaskPool(join(home,'private'),()=>clock);
try{
 await pool.startup();
 const x=await pool.submit({title:'Inspect service',requires:['ops.inspect'],payload:{server:'selected'},
  idempotencyKey:'incident-1'});
 assert.equal(x.status,'queued');
 const duplicate=await pool.submit({title:'Inspect service',requires:['ops.inspect'],
  payload:{server:'selected'},idempotencyKey:'incident-1'});
 assert.equal(duplicate.taskId,x.taskId);assert.equal(duplicate.duplicate,true);
 await assert.rejects(pool.submit({title:'Changed',idempotencyKey:'incident-1'}),/duplicate_key_conflict/);
 assert.equal((await pool.claim({workerId:'worker-a',capabilities:['memory.search']})).status,'empty');
 const claims=await Promise.all(Array.from({length:8},(_,i)=>pool.claim({
  workerId:'worker-'+i,capabilities:['ops.inspect'],leaseMs:10000})));
 const winner=claims.find(c=>c.status==='claimed');
 assert(winner);assert.equal(claims.filter(c=>c.status==='claimed').length,1);
 assert.equal(winner.taskId,x.taskId);
 const worker=(await pool.list())[0].lease.workerId;
 assert.equal(worker,winner.token?worker:'');
 await assert.rejects(pool.transition({taskId:x.taskId,workerId:worker,
  token:'00000000-0000-0000-0000-000000000000',result:'done'},'completed'),/lease_conflict/);
 clock+=3000;
 assert.equal((await pool.transition({taskId:x.taskId,workerId:worker,token:winner.token},'claimed')).status,'claimed');
 const done=await pool.transition({taskId:x.taskId,workerId:worker,token:winner.token,result:{ok:true}},'completed');
 assert.equal(done.status,'completed');
 assert.equal((await pool.get(x.taskId)).status,'completed');
 assert.equal((await pool.claim({workerId:'third',capabilities:['ops.inspect']})).status,'empty');
 const y=await pool.submit({title:'Potential side effect',requires:[],payload:{a:1}});
 const claim=await pool.claim({workerId:'worker-r',capabilities:[],leaseMs:10000});
 assert.equal(claim.taskId,y.taskId);
 const restarted=new TaskPool(join(home,'private'),()=>clock);
 assert.equal((await restarted.startup()).uncertain,1);
 assert.equal((await restarted.get(y.taskId)).status,'needs_review');
 assert.equal((await restarted.claim({workerId:'second',capabilities:[]})).status,'empty');
 await assert.rejects(restarted.reconcile({taskId:y.taskId,decision:'requeue',reason:'checked'}),/invalid_review/);
 const reviewed=await restarted.reconcile({taskId:y.taskId,decision:'requeue',
  reason:'Confirmed no remote side effects',confirm:true});
 assert.equal(reviewed.status,'queued');
 const reclaim=await restarted.claim({workerId:'second',capabilities:[],leaseMs:10000});
 clock+=10001;
 const late=await restarted.transition({taskId:y.taskId,workerId:'second',token:reclaim.token,
  result:'unverified'},'completed');
 assert.equal(late.status,'needs_review');
 assert.equal((await restarted.claim({workerId:'other',capabilities:[]})).status,'empty');
 assert.equal((await restarted.reconcile({taskId:y.taskId,decision:'cancel',
  reason:'Execution outcome ambiguous',confirm:true})).status,'cancelled');
 assert.equal((await restarted.get(y.taskId)).status,'cancelled');
 console.log('TASK_POOL_OK dedup, capability claim, concurrent exclusive leases, fencing, recovery, expiry');
}finally{await rm(home,{recursive:true,force:true});}

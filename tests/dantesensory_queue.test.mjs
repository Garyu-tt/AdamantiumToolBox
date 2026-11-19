import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';
const event=(sequence,source='world.mock')=>({schema:'dante.sensory.event.v1',source,kind:'position',
 sequence,observedAtMs:sequence,payload:{position:sequence}});
test('at least once: replay after restart, ack, duplicate and bounds',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-spool-')),path=join(dir,'queue.json');
 try{
  let q=await new DurableQueue({path,capacity:2,maxSources:2,maxEventBytes:1024}).open();
  const first=await q.publish(event(0));assert(first.ok);
  assert.equal(q.peek()[0].id,first.id);
  q=await new DurableQueue({path,capacity:2,maxSources:2,maxEventBytes:1024}).open();
  assert.equal(q.peek()[0].id,first.id,'unacked event survives restart');
  assert.deepEqual(await q.publish(event(0)),{ok:true,id:first.id,duplicate:true});
  const second=await q.publish(event(1));assert(second.ok);
  assert.deepEqual(await q.publish(event(2)),{ok:false,reason:'backpressure'});
  assert.equal((await q.ack(first.id)).ok,true);
  assert.deepEqual(await q.ack(first.id),{ok:true,already:true});
  q=await new DurableQueue({path,capacity:2,maxSources:2,maxEventBytes:1024}).open();
  assert.deepEqual(q.peek().map(e=>e.id),[second.id]);
  assert.deepEqual(await q.publish(event(0)),{ok:false,reason:'non_monotonic_sequence'});
  const third=await q.publish(event(0,'second.source'));assert(third.ok);
  assert.deepEqual(await q.publish(event(0,'third.source')),{ok:false,reason:'backpressure'});
  await q.ack(second.id);
  assert.deepEqual(await q.publish(event(0,'third.source')),{ok:false,reason:'too_many_sources'});
  const inFlight=q.peek()[0];assert.equal(inFlight.id,third.id);
  await q.ack(third.id);
  q=await new DurableQueue({path,capacity:2,maxSources:2,maxEventBytes:1024}).open();
  assert.equal(q.peek().length,0);assert.equal(q.status().sources,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('reject bad payload, failed write without state mutation, corrupt state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-spool-')),path=join(dir,'queue.json');
 try{
  const q=await new DurableQueue({path,capacity:3,maxSources:3,maxEventBytes:512}).open();
  await assert.rejects(q.publish({...event(0),payload:{big:'x'.repeat(700)}}),/event_too_large/);
  const cyclic={};cyclic.self=cyclic;
  await assert.rejects(q.publish({...event(0),payload:cyclic}),/invalid_event/);
  assert.equal(q.status().queued,0);
  assert((await q.publish(event(0))).ok);
  await writeFile(path,'{bad-json');
  await assert.rejects(new DurableQueue({path,capacity:3,maxSources:3,maxEventBytes:512}).open(),/spool_corrupt/);
  assert.equal(q.status().queued,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('serializes concurrent publish without state loss',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-spool-')),path=join(dir,'queue.json');
 try{
  const q=await new DurableQueue({path,capacity:32,maxSources:2,maxEventBytes:512}).open();
  const batch=await Promise.all(Array.from({length:20},(_,i)=>q.publish(event(i))));
  assert(batch.every(x=>x.ok));assert.equal(q.peek(16).length,16);
  const recovered=await new DurableQueue({path,capacity:32,maxSources:2,maxEventBytes:512}).open();
  assert.equal(recovered.status().queued,20);
  console.log('DANTE_SENSOR_JOURNAL_OK 20 commits, bounded state, replay, ack');
 }finally{await rm(dir,{recursive:true,force:true});}
});

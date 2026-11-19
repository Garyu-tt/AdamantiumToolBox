import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';
const event=n=>({schema:'dante.sensory.event.v1',source:'world.mock',kind:'position',
 sequence:n,observedAtMs:n,payload:{position:n}});
test('explicit fresh-read observes committed cross-instance publish and ACK',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-read-fresh-')),path=join(dir,'journal.json');
 try{
  const reader=await new DurableQueue({path}).open();
  const writer=await new DurableQueue({path}).open();
  const sent=await writer.publish(event(0));assert.equal(sent.ok,true);
  assert.equal(reader.peek().length,0,'legacy synchronous API is cached');
  assert.equal((await reader.peekFresh()).length,1);
  assert.equal((await reader.statusFresh()).queued,1);
  assert.equal((await writer.ack(sent.id)).ok,true);
  assert.equal((await reader.peekFresh()).length,0);
  assert.equal((await reader.statusFresh()).queued,0);
  assert.equal(reader.status().sources,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('corrupt durable record fails closed without changing prior cache or disk',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-read-fresh-')),path=join(dir,'journal.json');
 try{
  const q=await new DurableQueue({path}).open();
  assert.equal((await q.publish(event(0))).ok,true);
  await writeFile(path,'{bad-json');
  const before=await readFile(path);
  await assert.rejects(q.peekFresh(),/spool_corrupt/);
  assert.equal(q.peek().length,1);
  assert.deepEqual(await readFile(path),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});

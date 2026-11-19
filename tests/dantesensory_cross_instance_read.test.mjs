import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';

const event=n=>({schema:'dante.sensory.event.v1',source:'world.mock',
 kind:'position',sequence:n,observedAtMs:n,payload:{position:n}});

test('already-open reader observes another writer publish and ACK',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-reader-fresh-'));
 try{
  const path=join(dir,'journal.json');
  const reader=await new DurableQueue({path}).open();
  const writer=await new DurableQueue({path}).open();
  const published=await writer.publish(event(0));
  assert.equal(published.ok,true);
  assert.equal(reader.peek().length,1,
   'reader must discover a committed event without needing a local mutation');
  assert.equal(reader.status().queued,1);
  assert.equal((await writer.ack(published.id)).ok,true);
  assert.equal(reader.peek().length,0,
   'reader must not redeliver an event ACKed by another writer');
  assert.equal(reader.status().queued,0);
 }finally{
  await rm(dir,{recursive:true,force:true});
 }
});

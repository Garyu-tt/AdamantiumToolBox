import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';
const event=n=>({schema:'dante.sensory.event.v1',source:'world.mock',
 kind:'position',sequence:n,observedAtMs:n,payload:{position:n}});
test('stale writer lock blocks mutations without touching durable spool',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-writer-lock-'));
 const path=join(dir,'journal.json');
 try{
  const a=await new DurableQueue({path}).open();
  assert.equal((await a.publish(event(0))).ok,true);
  const before=await readFile(path);
  await writeFile(path+'.writer.lock','crashed-writer',{flag:'wx'});
  const b=await new DurableQueue({path}).open();
  await assert.rejects(b.publish(event(1)),/journal_writer_locked/);
  await assert.rejects(a.ack(a.peek()[0].id),/journal_writer_locked/);
  assert.deepEqual(await readFile(path),before);
  assert.equal((await b.open()).peek().length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

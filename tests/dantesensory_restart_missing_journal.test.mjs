import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm,unlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';
const event=n=>({schema:'dante.sensory.event.v1',source:'world.mock',kind:'position',
 sequence:n,observedAtMs:n,payload:{position:n}});
test('journal loss across restart fails closed and cannot recreate history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-restart-loss-')),path=join(dir,'journal.json');
 try{
  const first=await new DurableQueue({path}).open();
  assert.equal((await first.publish(event(0))).ok,true);
  assert.match(await readFile(path+'.initialized','utf8'),/initialized.v1/);
  await unlink(path);
  await assert.rejects(new DurableQueue({path}).open(),/journal_missing_after_commit/);
  const restarted=new DurableQueue({path});
  await assert.rejects(restarted.publish(event(1)),/journal_missing_after_commit/);
  await assert.rejects(readFile(path),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('uninitialized path can commit once and restart reads same history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-restart-init-')),path=join(dir,'journal.json');
 try{
  const first=await new DurableQueue({path}).open();
  assert.equal((await first.publish(event(0))).ok,true);
  const restarted=await new DurableQueue({path}).open();
  assert.equal(restarted.peek().length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

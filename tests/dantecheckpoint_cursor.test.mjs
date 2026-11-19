import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CheckpointManager} from '../apps/dantecheckpoint/manager.mjs';
import {OrderedCheckpointManager,ORDERED_CURSOR_SCHEMA} from '../apps/dantecheckpoint/ordered_cursor.mjs';
const id='dante.test',a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
test('older distinct event hash cannot overwrite newer checkpoint after restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-cursor-')),path=join(dir,'state.json');
 try{
  let manager=await new OrderedCheckpointManager(path).open();
  await manager.commit({instanceId:id,expectedRevision:0,sequence:10,eventId:a,
   previousEventId:null,state:{world:{tick:10}}});
  await manager.commit({instanceId:id,expectedRevision:1,sequence:11,eventId:b,
   previousEventId:a,state:{world:{tick:11}}});
  manager=await new OrderedCheckpointManager(path).open();
  assert.equal(manager.read().sequence,11);
  assert.equal(manager.read().state.world.tick,11);
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:2,
   sequence:9,eventId:c,previousEventId:b,state:{world:{tick:9}}}),
   /cursor_sequence_regression/);
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:2,
   sequence:12,eventId:c,previousEventId:a,state:{world:{tick:12}}}),
   /cursor_parent_conflict/);
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:2,
   sequence:11,eventId:c,previousEventId:b,state:{world:{tick:11}}}),
   /cursor_sequence_regression/);
  assert.equal(manager.read().revision,2);
  assert.equal((await new OrderedCheckpointManager(path).open()).read().state.world.tick,11);
  assert.equal(manager.status().cursorSchema,ORDERED_CURSOR_SCHEMA);
  await manager.commit({instanceId:id,expectedRevision:2,
   sequence:12,eventId:c,previousEventId:b,state:{world:{tick:12}}});
  assert.equal((await new OrderedCheckpointManager(path).open()).read().sequence,12);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('legacy hash-only checkpoint fails closed without migration',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-cursor-')),path=join(dir,'state.json');
 try{
  const legacy=await new CheckpointManager(path).open();
  await legacy.commit({instanceId:id,expectedRevision:0,lastEventId:a,state:{tick:1}});
  await assert.rejects(new OrderedCheckpointManager(path).open(),/cursor_migration_required/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('concurrent same-revision commits serialize and cannot overwrite',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-cursor-')),path=join(dir,'state.json');
 try{
  const manager=await new OrderedCheckpointManager(path).open();
  const [one,two]=await Promise.allSettled([
   manager.commit({instanceId:id,expectedRevision:0,sequence:1,eventId:a,previousEventId:null,state:{tick:1}}),
   manager.commit({instanceId:id,expectedRevision:0,sequence:2,eventId:b,previousEventId:null,state:{tick:2}})
  ]);
  assert.equal([one,two].filter(x=>x.status==='fulfilled').length,1);
  assert.equal([one,two].filter(x=>x.status==='rejected').length,1);
  assert.equal((await new OrderedCheckpointManager(path).open()).read().revision,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

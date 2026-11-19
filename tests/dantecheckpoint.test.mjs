import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {CheckpointManager,STATE_SCHEMA} from '../apps/dantecheckpoint/manager.mjs';
import {validateManifest,validateGraph} from '../core/contract.mjs';
import {fileURLToPath} from 'node:url';
const id='instance.test',evt='a'.repeat(64);
test('atomic checkpoint, expected revision, immutable commits, crash/reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-r2-')),path=join(dir,'state.json');
 try{
  let manager=await new CheckpointManager(path).open();assert.equal(manager.read(),null);
  const s={world:{tick:4,position:2}};
  const commit=manager.commit({instanceId:id,expectedRevision:0,lastEventId:evt,state:s});
  s.world.position=90;
  assert.equal((await commit).revision,1);
  assert.equal(manager.read().state.world.position,2,'caller cannot mutate pending state');
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:0,lastEventId:'b'.repeat(64),state:{}}),/revision_conflict/);
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:1,lastEventId:evt,state:{}}),/event_already_committed/);
  await assert.rejects(manager.commit({instanceId:'other',expectedRevision:1,lastEventId:'b'.repeat(64),state:{}}),/instance_mismatch/);
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:1,lastEventId:null,state:{}}),/event_cursor_regression/);
  let restored=await new CheckpointManager(path).open();
  assert.equal(restored.read().lastEventId,evt);assert.equal(restored.read().revision,1);
  const changed=restored.read();changed.state.world.position=500;
  assert.equal(restored.read().state.world.position,2);
  const results=await Promise.allSettled([restored.commit({instanceId:id,expectedRevision:1,lastEventId:'b'.repeat(64),state:{x:1}}),restored.commit({instanceId:id,expectedRevision:1,lastEventId:'c'.repeat(64),state:{x:2}})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal(restored.status().revision,2);
  await writeFile(path,'CORRUPTION');
  await assert.rejects(new CheckpointManager(path).open(),/checkpoint_corrupt/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('reject cyclical state and oversize without destroying last good state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dante-r2-')),path=join(dir,'state.json');
 try{
  const manager=await new CheckpointManager(path,{maxBytes:2048}).open();
  const first=await manager.commit({instanceId:id,expectedRevision:0,lastEventId:evt,state:{ok:true}});
  const bad={};bad.self=bad;
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:1,lastEventId:'b'.repeat(64),state:bad}));
  await assert.rejects(manager.commit({instanceId:id,expectedRevision:1,lastEventId:'b'.repeat(64),state:{big:'x'.repeat(3000)}}),/state_too_large/);
  assert.equal(manager.status().revision,first.revision);
  assert.equal((await new CheckpointManager(path,{maxBytes:2048}).open()).read().state.ok,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

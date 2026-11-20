// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {identity} from '../core/node_identity.mjs';
import {factoryLifecyclePreflight,stageFactoryAnchor,inspectFactoryStage}
 from '../tools/factory-anchor-lifecycle-r10.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
import {fixture} from '../packages/factory_anchor/tests/fixture.mjs';

const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
async function sandbox(){
 const path=await mkdtemp(join(tmpdir(),'factory-r10-lifecycle-'));
 const runtime=join(path,'Adamantium Toolbox');
 await mkdir(runtime);
 const id=await identity(join(runtime,'mesh'));
 await writeFile(join(runtime,'policy.json'),JSON.stringify({
  schema:'mas-owner-policy-1',
  capabilities:['factory_anchor.read','factory_anchor.attest']
 }));
 const f=await fixture();
 const previous=process.env.LOCALAPPDATA;
 process.env.LOCALAPPDATA=path;
 return {path,runtime,id,f,restore:async()=>{
  if(previous===undefined)delete process.env.LOCALAPPDATA;
  else process.env.LOCALAPPDATA=previous;
  await f.remove();
  await rm(path,{recursive:true,force:true,maxRetries:4,retryDelay:80});
 }};
}
import {activate,rollback} from '../standards/lifecycle/apply.mjs';
test('R10 legitimate activation requires explicit approval and has real rollback',
 {concurrency:false,timeout:35000},async()=>{
 const x=await sandbox();
 const env=['FACTORY_ANCHOR_ROOT','FACTORY_ANCHOR_PUBLIC_PIN',
  'FACTORY_ANCHOR_SOURCE_PIN','FACTORY_ANCHOR_LEDGER_ID','FACTORY_ANCHOR_ALLOW_SIGNING'];
 const beforeEnv=Object.fromEntries(env.map(n=>[n,process.env[n]]));
 try{
  process.env.FACTORY_ANCHOR_ROOT=x.f.root;
  process.env.FACTORY_ANCHOR_PUBLIC_PIN=x.f.anchorPin;
  process.env.FACTORY_ANCHOR_SOURCE_PIN=x.f.sourcePin;
  process.env.FACTORY_ANCHOR_LEDGER_ID=x.f.ledgerId;
  process.env.FACTORY_ANCHOR_ALLOW_SIGNING='no';
  const pre=await factoryLifecyclePreflight(project,x.runtime);
  const stage=await stageFactoryAnchor(project,x.runtime,pre.runtimeRegistryRevision);
  await assert.rejects(activate(project,x.runtime,stage.activationPlan),
   /explicit_approval_required/);
  assert.equal((await current(x.runtime)).apps.length,0);
  await assert.rejects(activate(project,x.runtime,{
   ...stage.activationPlan,plan_id:'forged'
  },true),/plan_changed/);
  const selected=await activate(project,x.runtime,stage.activationPlan,true);
  assert.equal(selected.app,'factory_anchor');
  assert.equal(selected.probe,'passed');
  assert.equal((await current(x.runtime)).apps[0].hash,stage.digest);
  const inspect=await inspectFactoryStage(project,x.runtime,stage.digest);
  assert.equal(inspect.state,'selected');
  assert.equal(inspect.active,true);
  const back=await rollback(project,x.runtime,'factory_anchor',true);
  assert.equal(back.state,'rolled_back');
  assert.equal(back.hash,null);
  assert.equal((await current(x.runtime)).apps.length,0);
 }finally{
  for(const [name,value] of Object.entries(beforeEnv))
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  await x.restore();
 }
});

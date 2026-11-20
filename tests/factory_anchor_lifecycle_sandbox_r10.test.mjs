// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createPublicKey,verify} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {sandboxLifecycleStudioLane} from '../packages/factory_anchor/sandbox-lifecycle-studio-r10.mjs';
const execute=promisify(execFile);
const script=fileURLToPath(new URL('../tools/factory-anchor-lifecycle-r10-sandbox.mjs',import.meta.url));
test('disposable signer leaves independently verifiable public signature and no active installation',
 {timeout:25000},async()=>{
 const output=await mkdtemp(join(tmpdir(),'factory-lifecycle-sandbox-view-'));
 try{
  const result=await execute(process.execPath,[script,output]);
  const command=JSON.parse(result.stdout);
  const file=join(output,'factory-anchor-r10-sandbox-stage.json');
  const proof=JSON.parse(await readFile(file,'utf8'));
  assert.equal(command.state,'sandbox_signed_staged_unactivated');
  assert.equal(proof.state,'sandbox_signed_staged_unactivated');
  assert.equal(proof.testIdentityOnly,true);
  assert.equal(proof.ownerProductionIdentityUsed,false);
  assert.equal(proof.ephemeralSigningKeyDestroyed,true);
  assert.equal(proof.productionCoreModified,false);
  assert.equal(proof.ownerPolicyModified,false);
  assert.equal(proof.productionAppActivated,false);
  assert.equal(proof.testCoreActiveApps,0);
  assert.equal(proof.signedPackageReadbackVerified,true);
  assert.equal(verify(null,Buffer.from(proof.packageHash),
   createPublicKey(proof.testKeyPublicPem),
   Buffer.from(proof.testPackageSignature,'base64')),true);
  const lane=sandboxLifecycleStudioLane(output);
  assert.equal(lane.testIdentityOnly,true);
  assert.equal(lane.mutatesOwnerPolicy,false);
  assert.equal(lane.installsProduction,false);
  assert.equal(lane.nodes.length,8);
  const ids=new Set(lane.nodes.map(x=>x.id));
  assert.equal(ids.size,lane.nodes.length);
  for(const node of lane.nodes)for(const group of node.wires||[])
   for(const target of group)assert.ok(ids.has(target));
  const allowed=new Set(['comment','watch','inject','file in','json','switch','debug']);
  assert.ok(lane.nodes.every(n=>allowed.has(n.type)));
  assert.ok(lane.nodes.every(n=>n.z==='f10f000000000001'));
 }finally{await rm(output,{recursive:true,force:true,maxRetries:4,retryDelay:90});}
});
test('isolated proof observer refuses relative and root paths',()=>{
 for(const x of ['',null,'relative/path',resolve('/')])
  assert.throws(()=>sandboxLifecycleStudioLane(x),
   /sandbox_status_absolute_path_required|sandbox_status_root_refused/);
});

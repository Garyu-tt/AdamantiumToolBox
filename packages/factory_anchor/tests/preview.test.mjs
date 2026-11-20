// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {fixture} from './fixture.mjs';
import {openFactoryAnchor} from '../lib/store.mjs';
import {factoryAnchorStudioPreview} from '../studio-preview.mjs';
import {ZERO,verifySource} from '../lib/proof.mjs';
const execute=promisify(execFile);
const script=fileURLToPath(new URL('../cli-preview.mjs',import.meta.url));
test('R09 public-only CLI produces bounded real cryptographic status visible in Node-RED',async()=>{
 const f=await fixture();
 try{
  const statusDirectory=join(f.dir,'ui');
  await mkdir(statusDirectory);
  const signer=openFactoryAnchor({root:f.root,ledgerId:f.ledgerId,
   anchorPin:f.anchorPin,sourcePin:f.sourcePin,allowSigning:true});
  const src=verifySource(f.bundle(),{ledgerId:f.ledgerId,sourcePin:f.sourcePin});
  const signed=await signer.attest({
   bundle:f.bundle(),expectedReceiptHash:ZERO,
   expectedSourceSequence:1,expectedSourceHead:src.head
  });
  assert.equal(signed.masApprovalGranted,false);
  const input=join(f.dir,'source-public-bundle.json');
  await writeFile(input,JSON.stringify(f.bundle()));
  const args=['inspect',f.root,input,f.anchorPin,f.sourcePin,
   f.ledgerId,statusDirectory];
  const a=await execute(process.execPath,[script,...args]);
  assert.equal(JSON.parse(a.stdout).result,'verified_current');
  const statusFile=join(statusDirectory,'factory-anchor-r09-status.json');
  const body=JSON.parse(await readFile(statusFile,'utf8'));
  assert.equal(body.status,'verified_current');
  assert.equal(body.appId,'factory_anchor');
  assert.equal(body.readOnlyPreview,true);
  assert.equal(body.masInstalledInCore,false);
  assert.equal(body.privateKeyRead,false);
  assert.equal(body.verification.anchorSignatureValid,true);
  assert.equal(body.verification.masApprovalGranted,false);
  assert.equal(body.permissionsGranted,false);
  const graph=factoryAnchorStudioPreview(statusDirectory);
  assert.equal(graph.masInstalled,false);
  assert.equal(graph.writesProduction,false);
  assert.equal(graph.nodes.length,12);
  assert.equal(new Set(graph.nodes.map(n=>n.id)).size,graph.nodes.length);
  const allowed=new Set(['tab','comment','watch','inject','file in','json','switch','debug']);
  assert.equal(graph.nodes.every(n=>allowed.has(n.type)),true);
  const ids=new Set(graph.nodes.map(n=>n.id));
  for(const node of graph.nodes)for(const group of node.wires||[])
   for(const target of group)assert.equal(ids.has(target),true);
  f.next();
  await writeFile(input,JSON.stringify(f.bundle()));
  await assert.rejects(execute(process.execPath,[script,...args]));
  const stale=JSON.parse(await readFile(statusFile,'utf8'));
  assert.equal(stale.status,'verified_stale');
  assert.equal(stale.verification.anchorSignatureValid,true);
  assert.equal(stale.permissionsGranted,false);
 }finally{await f.remove();}
});
test('R09 preview refuses relative status roots and never creates production actions',()=>{
 assert.throws(()=>factoryAnchorStudioPreview('relative/path'),/factory_anchor_status_absolute_path_required/);
 assert.ok(factoryAnchorStudioPreview('/tmp/factory-anchor-example').nodes.every(
  n=>!['exec','file','function','http request'].includes(n.type)));
});

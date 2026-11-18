import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verify,createPublicKey} from 'node:crypto';
import {signedIdentity,assertTargetNode} from '../core/identity.mjs';
test('Core mesh challenge signs the registered Ed25519 identity, rejects wrong target',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ada-identity-'));
 const oldLocal=process.env.LOCALAPPDATA,oldOverride=process.env.ADA_MESH_IDENTITY_DIR;
 process.env.LOCALAPPDATA=dir;delete process.env.ADA_MESH_IDENTITY_DIR;
 try{
  const challenge='c'.repeat(48),reply=await signedIdentity(challenge);
  assert.equal(reply.schema,'adamantium.core.identity.v1');assert.equal(reply.challenge,challenge);
  const owner=JSON.parse(await readFile(join(dir,'Adamantium Toolbox','mesh','identity.json'),'utf8'));
  assert.equal(reply.id,owner.id);
  const data='adamantium.core.identity.v1\n'+owner.id+'\n'+challenge;
  assert(verify(null,Buffer.from(data),createPublicKey(owner.publicKey),Buffer.from(reply.signature,'base64')));
  await assertTargetNode(owner.id);
  await assert.rejects(assertTargetNode('00000000-0000-0000-0000-000000000000'),/node_identity_mismatch/);
  await assert.rejects(signedIdentity('BAD'),/invalid_challenge/);
 }finally{
  if(oldLocal===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=oldLocal;
  if(oldOverride===undefined)delete process.env.ADA_MESH_IDENTITY_DIR;else process.env.ADA_MESH_IDENTITY_DIR=oldOverride;
  await rm(dir,{recursive:true,force:true});
 }
});

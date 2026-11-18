import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verify,createPublicKey,generateKeyPairSync} from 'node:crypto';
import {signedIdentity,assertTargetNode} from '../core/identity.mjs';
import {identity,existingIdentity} from '../core/node_identity.mjs';
test('Core signs preprovisioned Mesh identity, refuses missing or mismatched keys',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ada-identity-'));
 const oldLocal=process.env.LOCALAPPDATA,oldOverride=process.env.ADA_MESH_IDENTITY_DIR;
 process.env.LOCALAPPDATA=dir;delete process.env.ADA_MESH_IDENTITY_DIR;
 const root=join(dir,'Adamantium Toolbox','mesh'),file=join(root,'identity.json');
 const challenge='c'.repeat(48);
 try{
  await assert.rejects(signedIdentity(challenge),/identity_not_provisioned/);
  await assert.rejects(assertTargetNode('00000000-0000-0000-0000-000000000000'),/identity_not_provisioned/);
  const owner=await identity(root),reply=await signedIdentity(challenge);
  assert.equal(reply.schema,'adamantium.core.identity.v1');
  assert.equal(reply.challenge,challenge);assert.equal(reply.id,owner.id);
  const data='adamantium.core.identity.v1\n'+owner.id+'\n'+challenge;
  assert(verify(null,Buffer.from(data),createPublicKey(owner.publicKey),Buffer.from(reply.signature,'base64')));
  await assertTargetNode(owner.id);
  await assert.rejects(assertTargetNode('00000000-0000-0000-0000-000000000000'),/node_identity_mismatch/);
  await assert.rejects(signedIdentity('BAD'),/invalid_challenge/);
  const pair=generateKeyPairSync('ed25519');
  await writeFile(file,JSON.stringify({...owner,publicKey:pair.publicKey.export({type:'spki',format:'pem'})}));
  await assert.rejects(existingIdentity(root),/identity_key_mismatch/);
  await assert.rejects(signedIdentity(challenge),/identity_key_mismatch/);
  await assert.rejects(identity(root),/identity_key_mismatch/);
  await writeFile(file,JSON.stringify(owner));
  assert.equal((await existingIdentity(root)).id,owner.id);
  assert.equal(JSON.parse(await readFile(file,'utf8')).privateKey,owner.privateKey);
 }finally{
  if(oldLocal===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=oldLocal;
  if(oldOverride===undefined)delete process.env.ADA_MESH_IDENTITY_DIR;else process.env.ADA_MESH_IDENTITY_DIR=oldOverride;
  await rm(dir,{recursive:true,force:true});
 }
});

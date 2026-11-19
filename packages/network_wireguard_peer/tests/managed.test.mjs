import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,sign} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendManaged,loadManaged,replayLedger} from '../lib/managed.mjs';
import {snapshotHash} from '../lib/contract.mjs';
const cfg={interface:'wg0',pool:'10.223.44.0/24'};
const peer=()=>randomBytes(32).toString('base64');
const signed=plan=>{
 const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519'),msg=Buffer.from(JSON.stringify(plan));
 return {trust:{sourcePublicKeyPem:a.publicKey.export({format:'pem',type:'spki'}),
  destinationPublicKeyPem:b.publicKey.export({format:'pem',type:'spki'})},
  proofs:{source:sign(null,msg,a.privateKey).toString('base64'),destination:sign(null,msg,b.privateKey).toString('base64')}};
};
const plan=pub=>({schema:'network-wireguard-peer-plan-v1',operation:'add',
 interface:'wg0',peerPublicKey:pub,allowedIP:'10.223.44.7/32',expiresAt:Date.now()+90000,
 nonce:randomBytes(24).toString('base64url'),expectedState:snapshotHash([])});
test('signed managed ledger survives reload, rejects duplicate, tamper and untrusted missing file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-ledger-')),file=join(dir,'managed.jsonl');
 const p=plan(peer()),{trust,proofs}=signed(p);
 try{
  await assert.rejects(()=>loadManaged(file,trust,cfg),/ENOENT/);
  const first=await appendManaged(file,p,proofs,trust,cfg);
  assert.equal(first.revision,1);
  const state=await loadManaged(file,trust,cfg);
  assert.deepEqual(state.managed,[{publicKey:p.peerPublicKey,allowedIP:p.allowedIP}]);
  await assert.rejects(()=>appendManaged(file,p,proofs,trust,cfg),/operation_replayed/);
  const text=await readFile(file,'utf8');
  assert(!text.includes('PRIVATE KEY'));
  await writeFile(file,text.replace('10.223.44.7/32','10.223.44.9/32'));
  await assert.rejects(()=>loadManaged(file,trust,cfg),/managed_ledger_invalid/);
  assert.throws(()=>replayLedger(text,trust,{...cfg,interface:'wg1'}),/managed_ledger_invalid/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('remove must reference an originally signed managed address',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wg-ledger-rm-')),file=join(dir,'managed.jsonl'),pub=peer();
 const p=plan(pub),{trust,proofs}=signed(p);
 try{
  await appendManaged(file,p,proofs,trust,cfg);
  const wrong={...p,operation:'remove',nonce:randomBytes(24).toString('base64url'),allowedIP:'10.223.44.8/32'};
  const sigWrong=signed(wrong);
  await assert.rejects(()=>appendManaged(file,wrong,sigWrong.proofs,sigWrong.trust,cfg),/managed_ledger_invalid|unmanaged_peer/);
 }finally{await rm(dir,{recursive:true,force:true})}
});

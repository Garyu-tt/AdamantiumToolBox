// SPDX-License-Identifier: Apache-2.0
// Fully self-contained fixture; no dependency on network_* or Node-RED.
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ZERO,sha} from '../lib/proof.mjs';
const keypair=()=>generateKeyPairSync('ed25519');
const pub=x=>x.publicKey.export({type:'spki',format:'pem'}).toString();
const priv=x=>x.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const signed=(data,key)=>{
 const signature=sign(null,Buffer.from(JSON.stringify(data)),key.privateKey)
  .toString('base64url');
 return {...data,signature};
};
const stamp='2026-11-20T00:00:01.000Z';
export async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'factory-anchor-mas-r09-'));
 const root=join(dir,'anchor');
 const {mkdir}=await import('node:fs/promises');
 await mkdir(root,{mode:0o700});
 const sourceKey=keypair(),anchorKey=keypair();
 const sourcePin=sha(pub(sourceKey)),anchorPin=sha(pub(anchorKey));
 const ledgerId='factory-r09-tests',witnessId='witness-tests-r09';
 const identity={
  schema:'adamantium.factory.offhost-anchor/1',
  anchorId:'anchor-'+anchorPin.slice(7,31),
  keyFingerprint:anchorPin,sourceKeyPin:sourcePin,sourceLedgerId:ledgerId
 };
 await writeFile(join(root,'anchor-identity.json'),
   JSON.stringify(identity)+'\n',{mode:0o600});
 await writeFile(join(root,'anchor-public.pem'),pub(anchorKey),{mode:0o644});
 await writeFile(join(root,'anchor-private.pem'),priv(anchorKey),{mode:0o600});
 await writeFile(join(root,'anchor.jsonl'),'',{mode:0o600});
 const sourceIdentity={
  schema:'adamantium.factory.witness-identity/1',
  ledgerId,witnessId,keyFingerprint:sourcePin
 };
 const history=[];
 const witness=[];
 const push=(kind,payload)=>{
  const previous=history.at(-1);
  const before={
   schema:'adamantium.factory.event/1',
   sequence:history.length+1,previous:previous?.hash||ZERO,
   kind,recordedAt:stamp,payload
  };
  const event={...before,hash:sha(JSON.stringify(before))};
  history.push(event);
  const beforeReceipt={
   schema:'adamantium.factory.witness-receipt/1',
   ledgerId,witnessId,sequence:event.sequence,head:event.hash,
   previousReceipt:witness.at(-1)?.receiptHash||ZERO,
   issuedAt:stamp
  };
  const receiptUnsigned=signed(beforeReceipt,sourceKey);
  const receipt={...receiptUnsigned,
   receiptHash:sha(JSON.stringify(receiptUnsigned))};
  witness.push(receipt);
  return event;
 };
 const proposalId='candidate-'+'a'.repeat(32);
 push('factory.proposed',{proposalId,contract:{
  schema:'adamantium.node-factory/1',id:'demo-uppercase'
 },sourceDigest:sha('factory-demo')});
 const bundle=()=>({
  schema:'adamantium.factory.public-bundle/1',
  ledgerId,identity:sourceIdentity,publicKeyPem:pub(sourceKey),
  journalJSONL:history.map(x=>JSON.stringify(x)).join('\n')+'\n',
  witnessJSONL:witness.map(x=>JSON.stringify(x)).join('\n')+'\n'
 });
 const next=()=>push('factory.rejected',{proposalId,reason:'unit_test_rejected'});
 return {
  dir,root,identity,sourcePin,anchorPin,ledgerId,sourceKey,anchorKey,
  bundle,next,remove:()=>rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:70})
 };
}

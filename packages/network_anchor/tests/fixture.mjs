import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {sourceBytes,sealReceipt} from '../../network_witness/lib/contract.mjs';
import {ORIGIN,sha} from '../lib/contract.mjs';
const pair=()=>generateKeyPairSync('ed25519');
const pub=k=>k.publicKey.export({type:'spki',format:'pem'}).toString();
const pem=k=>k.privateKey.export({type:'pkcs8',format:'pem'}).toString();
export async function fixture(){
 const home=await mkdtemp(join(tmpdir(),'network-anchor-test-'));
 const keys={source:pair(),witness:pair(),anchor:pair()};
 const trust={schema:'network-anchor-trust-v1',anchor:{id:'independent_anchor',keyId:'anchor-key',publicKey:pub(keys.anchor)},
  witness:{id:'auditor',keyId:'witness-key',publicKey:pub(keys.witness)},
  sources:{approval:{id:'approval',keyId:'source-key',publicKey:pub(keys.source)}}};
 const trustPath=join(home,'trust.json'),keyPath=join(home,'anchor.key'),logPath=join(home,'anchor.log');
 await writeFile(trustPath,JSON.stringify(trust),{mode:0o600});
 await writeFile(keyPath,pem(keys.anchor),{mode:0o600});
 let previous=ORIGIN,seq=0;
 const next=()=>{
  seq++;const checkpoint={schema:'network-approval-checkpoint-v1',journalId:'approval',seq,
   head:sha('approval-ledger:'+seq),keyId:'source-key',at:new Date().toISOString()};
  const sourceSignature=sign(null,sourceBytes(checkpoint),keys.source.privateKey).toString('base64');
  const receipt={schema:'network-witness-receipt-v1',witnessId:'auditor',journalId:'approval',anchorSeq:seq,
   ledgerSeq:seq,ledgerHead:checkpoint.head,previousWitnessHead:previous,
   sourceProofHash:sha(JSON.stringify({checkpoint,signature:sourceSignature})),
   checkpoint,sourceSignature,at:new Date().toISOString()};
  const signature=sealReceipt(receipt,keys.witness.privateKey);
  const witnessRevision=sha(JSON.stringify({seq,previous,record:receipt}));
  previous=witnessRevision;return {receipt,signature,witnessRevision};
 };
 return {home,trust,keys,trustPath,keyPath,logPath,next,
  remove:()=>rm(home,{recursive:true,force:true,maxRetries:5,retryDelay:100})};
}

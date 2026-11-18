import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SOURCE_SCHEMA,ORIGIN,sourceBytes} from '../lib/contract.mjs';
const keys=()=>generateKeyPairSync('ed25519');
const pub=k=>k.publicKey.export({type:'spki',format:'pem'}).toString();
export async function fixture(){
 const home=await mkdtemp(join(tmpdir(),'nwitness-')),src=keys(),wit=keys();
 const trust={schema:'network-witness-trust-v1',witness:{id:'auditor',keyId:'witness-key',publicKey:pub(wit)},
  sources:{approval:{id:'approval',keyId:'source-key',publicKey:pub(src)}}};
 const trustPath=join(home,'trust.json'),keyPath=join(home,'signer.pem'),logPath=join(home,'witness.jsonl');
 await writeFile(trustPath,JSON.stringify(trust),{mode:0o600});
 await writeFile(keyPath,wit.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 function segment(startSeq=0,startHead=ORIGIN,events=[{type:'propose',proof:{side:'source'}}]){
  let prev=startHead,seq=startSeq;const rows=[];
  for(const event of events){seq++;const row={seq,previous:prev,event};
   row.hash=createHash('sha256').update(JSON.stringify({seq,previous:prev,event})).digest('hex');rows.push(row);prev=row.hash;}
  const checkpoint={schema:SOURCE_SCHEMA,journalId:'approval',seq,head:prev,keyId:'source-key',at:new Date().toISOString()};
  return {checkpoint,signature:sign(null,sourceBytes(checkpoint),src.privateKey).toString('base64'),segment:rows};
 }
 return {home,trust,keyPath,trustPath,logPath,source:src,witness:wit,segment,
  remove:()=>rm(home,{recursive:true,force:true,maxRetries:3,retryDelay:100})};
}

import {readFile,lstat,open,stat,unlink} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {ORIGIN,sha,validTrust,verifyWitness,keyFromPem,signAttestation,verifyAttestation} from './contract.mjs';
const invalid=reason=>{throw Error(reason)};
const okPath=p=>typeof p==='string'&&isAbsolute(p)&&p.length<4000;
async function privateFile(path,max){if(!okPath(path))invalid('invalid_path');const s=await lstat(path);
 if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)||s.size>max)invalid('unsafe_private_file');return readFile(path,'utf8');}
function advance(batch,last,trust){if(!Array.isArray(batch)||batch.length<1||batch.length>16)invalid('invalid_batch');
 let seq=last.seq,head=last.head;const latest=new Map(last.byJournal);
 for(const item of batch){if(!verifyWitness(item,trust)||item.receipt.anchorSeq!==seq+1||
  item.receipt.previousWitnessHead!==head)invalid('invalid_witness_chain');
  const journal=item.receipt.journalId,prev=latest.get(journal)||0;
  if(item.receipt.ledgerSeq<=prev)invalid('ledger_regression');
  latest.set(journal,item.receipt.ledgerSeq);seq++;head=item.witnessRevision;
 }
 return {seq,head,byJournal:latest};
}
export class AnchorStore {
 constructor(path,trust,key){if(!okPath(path))invalid('invalid_path');this.path=path;this.trust=validTrust(trust);this.key=key;
  this.lock=null;this.queue=Promise.resolve();this.head=ORIGIN;this.count=0;this.witnessSeq=0;this.witnessHead=ORIGIN;this.byJournal=new Map();this.entries=[];}
 async start(){const s=await lstat(this.path).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(s&&(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)))invalid('unsafe_anchor_journal');
  this.lock=await open(this.path+'.lock','wx',0o600).catch(e=>{if(e.code==='EEXIST')invalid('anchor_already_locked');throw e;});
  try{await this.lock.writeFile(JSON.stringify({pid:process.pid}));await this.lock.sync();
   if(!s){const f=await open(this.path,'wx',0o600);await f.close();}
   await this.reload();return this;}catch(e){await this.close();throw e;}
 }
 async reload(){const s=await lstat(this.path);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)||s.size>8*1024*1024)invalid('unsafe_anchor_journal');
  const raw=await readFile(this.path,'utf8');if(raw&&!raw.endsWith('\n'))invalid('truncated_anchor_journal');
  let head=ORIGIN,count=0,last={seq:0,head:ORIGIN,byJournal:new Map()};const entries=[];
  for(const line of raw?raw.trimEnd().split('\n'):[]){let row;try{row=JSON.parse(line);}catch{invalid('corrupt_anchor_journal');}
   if(row?.seq!==count+1||row.previous!==head||!Array.isArray(row.batch)||typeof row.at!=='string')invalid('corrupt_anchor_journal');
   last=advance(row.batch,last,this.trust);
   const data={seq:row.seq,previous:row.previous,batch:row.batch,at:row.at};
   if(row.head!==sha(JSON.stringify(data))||!verifyAttestation(row.attestation,row.signature,this.trust)||
    row.attestation.anchorSeq!==row.seq||row.attestation.anchorHead!==row.head||
    row.attestation.witnessSeq!==last.seq||row.attestation.witnessHead!==last.head)invalid('corrupt_anchor_journal');
   head=row.head;count++;entries.push({attestation:row.attestation,signature:row.signature,revision:row.head});
  }
  this.head=head;this.count=count;this.witnessSeq=last.seq;this.witnessHead=last.head;this.byJournal=last.byJournal;this.entries=entries;
 }
 status(){return {configured:true,revision:this.head,count:this.count,witnessSeq:this.witnessSeq,witnessHead:this.witnessHead,enforcement:false,replicated:false};}
 latest(){return {revision:this.head,attestation:this.entries.at(-1)||null,enforcement:false};}
 inspect(entry){if(!verifyWitness(entry,this.trust))return {state:'invalid_proof',enforcement:false};
  const seq=entry.receipt.anchorSeq,head=entry.witnessRevision;
  const state=seq<this.witnessSeq?'older_than_anchor':seq===this.witnessSeq?
   (head===this.witnessHead?'matches_anchor':'fork_detected'):'ahead_of_anchor';
  return {state,anchoredSeq:this.witnessSeq,enforcement:false};}
 async commit({batch,expectedRevision}){const act=async()=>{
  await this.reload();if(expectedRevision!==this.head)invalid('revision_conflict');
  const after=advance(batch,{seq:this.witnessSeq,head:this.witnessHead,byJournal:this.byJournal},this.trust);
  const data={seq:this.count+1,previous:this.head,batch,at:new Date().toISOString()};
  const head=sha(JSON.stringify(data)),attestation={schema:'network-anchor-attestation-v1',anchorId:this.trust.anchor.id,
   witnessId:this.trust.witness.id,anchorSeq:data.seq,anchorHead:head,witnessSeq:after.seq,witnessHead:after.head,at:data.at};
  const row={...data,head,attestation,signature:signAttestation(attestation,this.key)},line=JSON.stringify(row)+'\n';
  const size=(await stat(this.path)).size;if(size+Buffer.byteLength(line)>8*1024*1024)invalid('anchor_journal_full');
  const f=await open(this.path,'a',0o600);try{await f.writeFile(line);await f.sync();}finally{await f.close();}
  await this.reload();return {revision:this.head,attestation,signature:row.signature,enforcement:false};
 };const p=this.queue.then(act,act);this.queue=p.catch(()=>{});return p;}
 async close(){if(!this.lock)return;const lock=this.lock;this.lock=null;await lock.close();await unlink(this.path+'.lock').catch(()=>{});}
}
export async function openAnchor({logPath,trustPath,keyPath}){if(!okPath(logPath)||!okPath(trustPath)||!okPath(keyPath))invalid('missing_paths');
 const trust=validTrust(JSON.parse(await privateFile(trustPath,32768))),key=keyFromPem(await privateFile(keyPath,8192),trust);
 return new AnchorStore(logPath,trust,key).start();}

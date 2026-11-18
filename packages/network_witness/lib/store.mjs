import {readFile,lstat,open,unlink} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {ORIGIN,validateTrust,validatePrivateKey,verifySource,canonicalCheckpoint,
 validateSegment,receiptPayload,sealReceipt,verifyReceipt,sourceProofHash,rowHash} from './contract.mjs';
const MAX_BYTES=8*1024*1024;
const fatal=why=>{throw Error(why);};
const abs=x=>typeof x==='string'&&isAbsolute(x)&&x.length<4000;
const privateFile=async path=>{if(!abs(path))fatal('missing_private_file');
 const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>8192)fatal('unsafe_private_file');
 return readFile(path,'utf8');
};
export async function openWitness({logPath,trustPath,keyPath}){
 if(!abs(logPath)||!abs(trustPath)||!abs(keyPath))fatal('missing_paths');
 const trust=validateTrust(JSON.parse(await readFile(trustPath,'utf8')));
 const key=validatePrivateKey(await privateFile(keyPath),trust);
 return new Witness(logPath,trust,key).start();
}
export class Witness{
 constructor(path,trust,key){this.path=path;this.trust=validateTrust(trust);this.key=key;
  this.lock=null;this.queue=Promise.resolve();this.head=ORIGIN;this.count=0;this.latest=new Map();this.receipts=[];}
 async start(){
  const st=await lstat(this.path).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(st&&(st.isSymbolicLink()||!st.isFile()||(st.mode&0o077)))fatal('unsafe_witness_log');
  this.lock=await open(this.path+'.lock','wx',0o600).catch(e=>{if(e.code==='EEXIST')fatal('writer_already_active');throw e;});
  try{await this.lock.writeFile(JSON.stringify({pid:process.pid}));await this.lock.sync();
   if(!st){const f=await open(this.path,'wx',0o600);await f.close();}
   await this.reload();return this;
  }catch(e){await this.close();throw e;}
 }
 async reload(){
  const st=await lstat(this.path);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)||st.size>MAX_BYTES)fatal('unsafe_witness_log');
  const raw=await readFile(this.path,'utf8');if(raw&&!raw.endsWith('\n'))fatal('truncated_witness_log');
  const lines=raw?raw.trimEnd().split('\n'):[];let prev=ORIGIN,seq=0;const latest=new Map(),receipts=[];
  for(const line of lines){let r;try{r=JSON.parse(line);}catch{fatal('corrupt_witness_log');}
   if(r?.seq!==seq+1||r.previous!==prev||r.hash!==rowHash(r.seq,r.previous,r.record)||
     !verifyReceipt(r.record,r.signature,this.trust))fatal('corrupt_witness_log');
   const rec=receiptPayload(r.record),last=latest.get(rec.journalId);
   if(rec.anchorSeq!==r.seq||rec.previousWitnessHead!==prev||
     rec.checkpoint.journalId!==rec.journalId||rec.checkpoint.seq!==rec.ledgerSeq||
     rec.checkpoint.head!==rec.ledgerHead||!verifySource(rec.checkpoint,rec.sourceSignature,this.trust)||
     sourceProofHash(rec.checkpoint,rec.sourceSignature)!==rec.sourceProofHash||
     (last&&rec.ledgerSeq<=last.ledgerSeq))fatal('witness_sequence_invalid');
   latest.set(rec.journalId,{ledgerSeq:rec.ledgerSeq,ledgerHead:rec.ledgerHead,receipt:r.record,signature:r.signature});
   receipts.push({receipt:r.record,signature:r.signature,witnessRevision:r.hash});prev=r.hash;seq++;
  }
  this.count=seq;this.head=prev;this.latest=latest;this.receipts=receipts;
 }
 status(){return {configured:true,count:this.count,revision:this.head,mode:'witness_only',enforcement:false,replicated:false};}
 list(limit=20){const n=Number.isInteger(limit)?Math.min(50,Math.max(1,limit)):20;
  return {revision:this.head,receipts:this.receipts.slice(-n),enforcement:false};}
 inspect(checkpoint,signature){
  const c=canonicalCheckpoint(checkpoint);
  if(!verifySource(c,signature,this.trust))return {state:'invalid_proof',matches:false,enforcement:false};
  const last=this.latest.get(c.journalId);
  if(!last)return {state:'unwitnessed',matches:false,enforcement:false};
  const state=c.seq<last.ledgerSeq?'rollback_detected':
   c.seq===last.ledgerSeq?(c.head===last.ledgerHead?'matches_witness':'fork_detected'):'ahead_of_witness';
  return {state,matches:state==='matches_witness',witnessedSeq:last.ledgerSeq,enforcement:false};
 }
 async anchor({checkpoint,signature,segment,expectedRevision}){
  const run=async()=>{
   await this.reload();if(expectedRevision!==this.head)fatal('revision_conflict');
   const c=canonicalCheckpoint(checkpoint);
   if(!verifySource(c,signature,this.trust))fatal('untrusted_checkpoint');
   const last=this.latest.get(c.journalId),seq=last?.ledgerSeq||0,head=last?.ledgerHead||ORIGIN;
   if(c.seq<=seq)fatal(c.seq===seq&&c.head!==head?'fork_detected':'rollback_detected');
   validateSegment(segment,seq,head,c);
   const record={schema:'network-witness-receipt-v1',witnessId:this.trust.witness.id,
    journalId:c.journalId,anchorSeq:this.count+1,ledgerSeq:c.seq,ledgerHead:c.head,
    previousWitnessHead:this.head,sourceProofHash:sourceProofHash(c,signature),
    checkpoint:c,sourceSignature:signature,at:new Date().toISOString()};
   const proof=sealReceipt(record,this.key),row={seq:this.count+1,previous:this.head,record,signature:proof};
   row.hash=rowHash(row.seq,row.previous,row.record);
   const entry=JSON.stringify(row)+'\n',st=await lstat(this.path);
   if(st.size+Buffer.byteLength(entry)>MAX_BYTES)fatal('witness_log_full');
   const f=await open(this.path,'a',0o600);try{await f.writeFile(entry);await f.sync();}finally{await f.close();}
   await this.reload();return {receipt:record,signature:proof,witnessRevision:row.hash,enforcement:false};
  };
  const p=this.queue.then(run,run);this.queue=p.catch(()=>{});return p;
 }
 async close(){if(!this.lock)return;const l=this.lock;this.lock=null;await l.close();await unlink(this.path+'.lock').catch(()=>{});}
}

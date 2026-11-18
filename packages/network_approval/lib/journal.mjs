import {readFile,stat,lstat,open,unlink} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {canonicalRequest,validateTrust,verifyProof,distinctPins,publicRequest,sha256,MAX_LIFETIME_MS} from './contract.mjs';
const ORIGIN='0'.repeat(64),MAX_BYTES=8*1024*1024;
const lineHash=(seq,previous,event)=>createHash('sha256').update(JSON.stringify({seq,previous,event})).digest('hex');
const safePath=x=>typeof x==='string'&&isAbsolute(x)&&x.length<4000;
const err=(code)=>{throw Error(code)};
function apply(index,event,trust,{replay=false}={}){
 if(!event||typeof event!=='object'||!['propose','endorse','revoke'].includes(event.type)||
  typeof event.at!=='string'||!Number.isFinite(Date.parse(event.at)))err('invalid_event');
 if(event.type==='propose'){
  const r=canonicalRequest(event.request),time=Date.parse(event.at);
  if(event.proof?.side!=='source'||!distinctPins(r,trust)||!verifyProof(r,event.proof,trust))err('untrusted_source');
  if(index.has(r.id))err('request_exists');
  if(Date.parse(r.expiresAt)<=time||Date.parse(r.expiresAt)>time+MAX_LIFETIME_MS)err('invalid_expiry');
  index.set(r.id,{request:r,source:event.proof,destination:null,revoke:null});return;
 }
 const item=index.get(event.id);
 if(!item)err('request_not_found');
 if(item.revoke)err('already_revoked');
 if(event.type==='endorse'){
  if(item.destination)err('already_endorsed');
  if(event.proof?.side!=='destination'||!verifyProof(item.request,event.proof,trust))err('untrusted_destination');
  if(Date.parse(item.request.expiresAt)<=Date.parse(event.at))err('request_expired');
  item.destination=event.proof;return;
 }
 if(!['owner_withdrawal','suspected_compromise','policy_change'].includes(event.reason)||
  !verifyProof(item.request,event.proof,trust,{kind:'revoke',reason:event.reason}))err('invalid_revocation');
 item.revoke={proof:event.proof,reason:event.reason,at:event.at};
}
export class Journal {
 constructor(path,trust){if(!safePath(path))err('missing_journal_path');this.path=path;this.trust=validateTrust(trust);this.lock=null;this.queue=Promise.resolve();this.entries=new Map();this.head=ORIGIN;this.count=0;}
 async start(){
  const target=await lstat(this.path).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(target&&(target.isSymbolicLink()||!target.isFile()||(target.mode&0o077)))err('unsafe_journal_file');
  this.lock=await open(this.path+'.lock','wx',0o600).catch(e=>{if(e.code==='EEXIST')err('journal_already_locked');throw e;});
  try{await this.lock.writeFile(JSON.stringify({pid:process.pid}));await this.lock.sync();
   if(!target){const fh=await open(this.path,'wx',0o600);await fh.close();}
   await this.reload();return this;
  }catch(e){await this.close();throw e;}
 }
 async reload(){
  const st=await lstat(this.path);if(st.isSymbolicLink()||!st.isFile()||(st.mode&0o077)||st.size>MAX_BYTES)err('unsafe_journal_file');
  const raw=await readFile(this.path,'utf8');
  if(raw&&!raw.endsWith('\n'))err('truncated_journal');
  const lines=raw?raw.trimEnd().split('\n'):[];
  const items=new Map();let previous=ORIGIN,seq=0;
  for(const line of lines){let row;try{row=JSON.parse(line);}catch{err('corrupt_journal');}
   if(row?.seq!==seq+1||row.previous!==previous||row.hash!==lineHash(row.seq,row.previous,row.event))err('corrupt_journal');
   try{apply(items,row.event,this.trust,{replay:true});}catch{err('invalid_journal_transition');}
   previous=row.hash;seq++;
  }
  this.head=previous;this.count=seq;this.entries=items;
 }
 list(){return {revision:this.head,count:this.count,requests:[...this.entries.values()].map(x=>publicRequest(x)),advisoryOnly:true,enforcement:false};}
 get(id){return publicRequest(this.entries.get(id));}
 async mutate({event,expectedRevision}){
  const run=async()=>{
   await this.reload();
   if(expectedRevision!==this.head)err('revision_conflict');
   const copy=new Map([...this.entries].map(([id,v])=>[id,{...v}]));
   apply(copy,event,this.trust);
   const seq=this.count+1,row={seq,previous:this.head,event};row.hash=lineHash(seq,row.previous,event);
   const line=JSON.stringify(row)+'\n';const st=await stat(this.path);
   if(st.size+Buffer.byteLength(line)>MAX_BYTES)err('journal_full');
   const handle=await open(this.path,'a',0o600);
   try{await handle.writeFile(line);await handle.sync();}finally{await handle.close();}
   this.entries=copy;this.head=row.hash;this.count=seq;
   return {revision:this.head,seq,requestId:event.type==='propose'?event.request.id:event.id,
    record:this.get(event.type==='propose'?event.request.id:event.id)};
  };
  const next=this.queue.then(run,run);this.queue=next.catch(()=>{});return next;
 }
 async close(){if(!this.lock)return;const lock=this.lock;this.lock=null;await lock.close();await unlink(this.path+'.lock').catch(()=>{});}
}

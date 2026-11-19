import {open,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import {digest,validatePlan,authorizedSignatures} from './contract.mjs';
const GENESIS='0'.repeat(64),MAX_BYTES=1024*1024,MAX_ENTRIES=512;
const encoded=e=>JSON.stringify({schema:e.schema,seq:e.seq,prev:e.prev,when:e.when,plan:e.plan,proofs:e.proofs});
const bad=()=>{throw Error('managed_ledger_invalid')};
export function replayLedger(text,trust,config){
 if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES)bad();
 const lines=text.split(/\r?\n/).filter(Boolean);
 if(lines.length>MAX_ENTRIES)bad();
 let head=GENESIS,seen=new Set(),managed=new Map(),addresses=new Map(),lastWhen=0;
 for(let i=0;i<lines.length;i++){
  let e;try{e=JSON.parse(lines[i])}catch{bad()}
  if(!e||typeof e!=='object'||Array.isArray(e)||
   Object.keys(e).sort().join(',')!=='hash,plan,prev,proofs,schema,seq,when'||
   e.schema!=='network-wireguard-managed-event-v1'||e.seq!==i+1||e.prev!==head||
   !Number.isSafeInteger(e.when)||e.when<lastWhen||e.when<=0||e.hash!==digest(encoded(e)))bad();
  try{
   validatePlan(e.plan,config,e.when-1);
   authorizedSignatures(e.plan,e.proofs,trust);
  }catch{bad()}
  if(seen.has(e.plan.nonce))bad();
  seen.add(e.plan.nonce);lastWhen=e.when;head=e.hash;
  const peer=e.plan.peerPublicKey,ip=e.plan.allowedIP;
  if(e.plan.operation==='add'){
   if(managed.has(peer)||addresses.has(ip))bad();
   managed.set(peer,ip);addresses.set(ip,peer);
  }else{
   if(managed.get(peer)!==ip)bad();
   managed.delete(peer);addresses.delete(ip);
  }
 }
 return {head,sequence:lines.length,managed:[...managed].map(([publicKey,allowedIP])=>({publicKey,allowedIP})),nonces:seen};
}
const inspect=async(path)=>{
 if(!isAbsolute(path)||path.includes('\0'))throw Error('managed_ledger_unconfigured');
 const parent=await stat(dirname(path));
 if(!parent.isDirectory()||(parent.mode&0o022)!==0)throw Error('unsafe_managed_ledger_dir');
};
export async function loadManaged(path,trust,config,{allowMissing=false}={}){
 await inspect(path);
 let file;try{file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW)}
 catch(e){if(e.code==='ENOENT'&&allowMissing)return replayLedger('',trust,config);throw e}
 try{
  const meta=await file.stat();
  if(!meta.isFile()||(meta.mode&0o077)!==0||meta.nlink!==1||meta.size>MAX_BYTES)throw Error('unsafe_managed_ledger');
  return replayLedger(await file.readFile({encoding:'utf8'}),trust,config);
 }finally{await file.close()}
}
export async function appendManaged(path,plan,proofs,trust,config){
 await inspect(path);
 const now=Date.now();
 validatePlan(plan,config,now);
 authorizedSignatures(plan,proofs,trust);
 let old='';
 try{const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const m=await file.stat();if(!m.isFile()||(m.mode&0o077)!==0||m.nlink!==1||m.size>MAX_BYTES)throw Error('unsafe_managed_ledger');
   old=await file.readFile({encoding:'utf8'});
  }finally{await file.close()}
 }catch(e){if(e.code!=='ENOENT')throw e}
 const state=replayLedger(old,trust,config);
 if(state.sequence>=MAX_ENTRIES||Buffer.byteLength(old)>MAX_BYTES-2048)throw Error('managed_ledger_full');
 if(state.nonces.has(plan.nonce))throw Error('operation_replayed');
 const existing=state.managed.find(p=>p.publicKey===plan.peerPublicKey);
 if(plan.operation==='add'&&(existing||state.managed.some(p=>p.allowedIP===plan.allowedIP)))throw Error('managed_peer_conflict');
 if(plan.operation==='remove'&&existing?.allowedIP!==plan.allowedIP)throw Error('unmanaged_peer');
 const e={schema:'network-wireguard-managed-event-v1',seq:state.sequence+1,prev:state.head,
  when:now,plan,proofs};e.hash=digest(encoded(e));
 const file=await open(path,constants.O_APPEND|constants.O_CREAT|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
 try{
  const m=await file.stat();
  if(!m.isFile()||(m.mode&0o077)!==0||m.nlink!==1)throw Error('unsafe_managed_ledger');
  if(m.size!==Buffer.byteLength(old))throw Error('managed_ledger_concurrent_change');
  await file.writeFile(JSON.stringify(e)+'\n');
  await file.sync();
 }finally{await file.close()}
 const dir=await open(dirname(path),'r');try{await dir.sync()}finally{await dir.close()}
 return {revision:e.seq,head:e.hash};
}

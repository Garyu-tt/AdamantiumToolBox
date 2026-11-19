import {mkdir,open,readFile,lstat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyForReservation} from './proof.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const validId=x=>typeof x==='string'&&/^[a-z][a-z0-9_.:-]{0,95}$/.test(x);
const validRoot=x=>typeof x==='string'&&isAbsolute(x)&&!x.includes('\0');
export const leasePath=(root,id)=>join(root,digest(id));
export async function checkRoot(root){
 if(!validRoot(root))return false;
 try{const st=await lstat(root);
  return st.isDirectory()&&!st.isSymbolicLink()&&(st.mode&0o077)===0;
 }catch{return false;}
}
async function syncDir(path){
 const f=await open(path,'r');
 try{await f.sync();}finally{await f.close();}
}
export async function inspectLease(id,options={}){
 const root=options.root;
 if(!validId(id))throw Error('invalid_lease_id');
 if(!await checkRoot(root))return {status:'unavailable',reason:'private_ledger_root_required'};
 const path=leasePath(root,id);
 let st;try{st=await lstat(path);}catch(e){
  if(e.code==='ENOENT')return {status:'unseen',leaseId:id};
  return {status:'indeterminate',leaseId:id,reason:'directory_stat_failed'};
 }
 if(!st.isDirectory()||st.isSymbolicLink())
  return {status:'indeterminate',leaseId:id,reason:'entry_not_private_directory'};
 try{
  const file=await lstat(join(path,'claim.json'));
  if(!file.isFile()||file.isSymbolicLink()||file.size>2048||
   (file.mode&0o077)!==0)throw Error('record_invalid');
  const claim=JSON.parse(await readFile(join(path,'claim.json'),'utf8'));
  if(claim.schema!=='rollback-ledger-claim-1'||claim.leaseId!==id||
   !/^[0-9a-f]{64}$/.test(claim.planDigest))throw Error('record_invalid');
  const now=options.nowSeconds??Math.floor(Date.now()/1000);
  return {status:'reserved',leaseId:id,planDigest:claim.planDigest,
   targetNode:claim.targetNode,expiresAt:claim.expiresAt,
   expired:now>=claim.expiresAt,localReplayConsumed:true,
   globallyAttested:false,requiresReview:now>=claim.expiresAt,
   readyToApply:false};
 }catch{return {status:'indeterminate',leaseId:id,
  reason:'incomplete_or_unreadable_reservation',localReplayConsumed:true,
  requiresReview:true,readyToApply:false};}
}
export async function reserveLease(input,options={}){
 const {receipt,context}=input||{},root=options.root;
 if(!await checkRoot(root))return {status:'unavailable',
  reason:'private_ledger_root_required',readyToApply:false};
 const now=options.nowSeconds??Math.floor(Date.now()/1000);
 const claim=verifyForReservation(receipt,context,options.trustedPublicKey,now);
 const path=leasePath(root,claim.leaseId);
 try{await mkdir(path,{mode:0o700});}
 catch(e){if(e.code==='EEXIST')return {status:'already_consumed',
  leaseId:claim.leaseId,localReplayConsumed:true,readyToApply:false};
  return {status:'indeterminate',reason:'reservation_directory_failed',
   localReplayConsumed:false,readyToApply:false};}
 try{
  await syncDir(root);
  const data=JSON.stringify({schema:'rollback-ledger-claim-1',...claim,
   reservedAt:now})+'\n';
  const file=await open(join(path,'claim.json'),'wx',0o600);
  try{await file.writeFile(data);await file.sync();}
  finally{await file.close();}
  await syncDir(path);
  return {status:'reserved',leaseId:claim.leaseId,
   planDigest:claim.planDigest,expiresAt:claim.expiresAt,
   keyFingerprint:claim.keyFingerprint,localReplayConsumed:true,
   globallyAttested:false,watchdogArmed:false,readyToApply:false};
 }catch{return {status:'indeterminate',leaseId:claim.leaseId,
  reason:'reservation_may_be_incomplete_never_reuse',
  localReplayConsumed:true,readyToApply:false};}
}

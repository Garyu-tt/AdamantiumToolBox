import {readdir,open,lstat,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {checkRoot,inspectLease,leasePath} from './store.mjs';
export async function auditReservations(options={}){
 if(!await checkRoot(options.root))
  return {schema:'rollback-ledger-audit-1',status:'unavailable',
   issues:[{code:'private_ledger_root_required'}],canApply:false};
 let names;
 try{names=await readdir(options.root);}catch{
  return {schema:'rollback-ledger-audit-1',status:'indeterminate',
   issues:[{code:'ledger_directory_unreadable'}],canApply:false};
 }
 if(names.length>1024)return {schema:'rollback-ledger-audit-1',
  status:'truncated',issues:[{code:'ledger_inventory_limit',count:names.length}],
  canApply:false};
 const issues=[],entries=[];
 for(const name of names.sort()){
  if(!/^[0-9a-f]{64}$/.test(name)){
   issues.push({code:'unexpected_entry'});continue;
  }
  try{
   const path=join(options.root,name),file=join(path,'claim.json');
   const dir=await lstat(path);
   const uid=typeof process.getuid==='function'?process.getuid():null;
   if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o077)||
    (uid!==null&&dir.uid!==uid))throw Error('unsafe_directory');
   const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
   let claim;
   try{
    const record=await handle.stat();
    if(!record.isFile()||record.size>2048||(record.mode&0o077)||
     (uid!==null&&record.uid!==uid))throw Error('unsafe_record');
    claim=JSON.parse(await handle.readFile({encoding:'utf8'}));
   }finally{await handle.close();}
   if(typeof claim.leaseId!=='string'||leasePath(options.root,claim.leaseId)!==path)
    throw Error('lease_digest_mismatch');
   const observed=await inspectLease(claim.leaseId,options);
   if(observed.status!=='reserved')throw Error('record_invalid');
   entries.push({leaseHash:name,leaseId:claim.leaseId,
    targetNode:observed.targetNode,planDigest:observed.planDigest,
    state:observed.expired?'expired_needs_review':'reserved_unverified',
    expiresAt:observed.expiresAt,requiresReview:true});
  }catch{
   entries.push({leaseHash:name,state:'incomplete_or_untrusted',
    requiresReview:true});
   issues.push({code:'unreadable_or_partial_lease',leaseHash:name,
    remediation:'quarantine and independently reconcile signed lease'});
  }
 }
 return {schema:'rollback-ledger-audit-1',status:'scanned',
  count:entries.length,entries,issues,
  allLeasesRecovered:issues.length===0,
  writerAttested:false,kernelVerified:false,readyToApply:false,
  canApply:false,applied:false};
}

import {readdir,lstat,open,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {checkRoot,inspectLease,leasePath} from './store.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export async function checkpointReservations(options={}){
 const expected=options.expectedDigest;
 if(expected!==undefined&&!hex(expected))throw Error('invalid_checkpoint_digest');
 const empty=(status,reason)=>({schema:'rollback-ledger-checkpoint-1',
  status,reason,rows:[],digest:null,issues:[{code:reason}],
  callerAnchorMatches:false,remoteAnchorVerified:false,
  writerAuthenticated:false,readyToApply:false});
 if(!await checkRoot(options.root))return empty('unavailable','private_root_required');
 let names;
 try{names=await readdir(options.root);}catch{
  return empty('unavailable','ledger_read_failed');}
 if(names.length>1024)return empty('truncated','ledger_inventory_limit');
 const rows=[],issues=[],uid=typeof process.getuid==='function'?process.getuid():null;
 for(const name of names.sort()){
  if(!hex(name)){issues.push({code:'unexpected_entry'});continue;}
  const folder=join(options.root,name),path=join(folder,'claim.json');
  try{
   const dir=await lstat(folder);
   if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o077)||
    (uid!==null&&dir.uid!==uid))throw Error('unsafe_directory');
   const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   let raw;
   try{
    const st=await handle.stat();
    if(!st.isFile()||st.size>2048||(st.mode&0o077)||
     (uid!==null&&st.uid!==uid))throw Error('unsafe_record');
    raw=await handle.readFile();
   }finally{await handle.close();}
   const record=JSON.parse(raw.toString('utf8'));
   if(typeof record.leaseId!=='string'||
    leasePath(options.root,record.leaseId)!==folder)throw Error('lease_hash_mismatch');
   const observed=await inspectLease(record.leaseId,options);
   if(observed.status!=='reserved'||observed.signatureVerified!==true)
    throw Error('approval_not_verified');
   rows.push({leaseHash:name,recordHash:sha(raw),state:'verified_signed_approval'});
  }catch{
   rows.push({leaseHash:name,recordHash:null,state:'untrusted_or_partial'});
   issues.push({code:'unverified_checkpoint_entry',leaseHash:name});
  }
 }
 const digest=sha(JSON.stringify(rows));
 return {schema:'rollback-ledger-checkpoint-1',status:issues.length?'degraded':'observed',
  digest,rows,issues,callerAnchorMatches:issues.length===0&&
   expected!==undefined&&expected===digest,
  externallyAnchored:false,remoteAnchorVerified:false,
  writerAuthenticated:false,kernelVerified:false,readyToApply:false};
}

import {readdir} from 'node:fs/promises';
import {checkRoot,inspectLease} from './store.mjs';
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
  if(!/^[0-9a-f]{64}$/.test(name)){issues.push({code:'unexpected_entry',
   entry:'unrecognized_name'});continue;}
  // Directory names are one-way lease hashes; never pretend to know an ID.
  entries.push({leaseHash:name,state:'opaque_reserved_or_tombstone',
   requiresReview:true,remediation:'verify signed receipt and kernel state out of band'});
 }
 return {schema:'rollback-ledger-audit-1',status:'scanned',
  count:entries.length,entries,issues,
  allLeasesRecovered:false,writerAttested:false,kernelVerified:false,
  canApply:false,applied:false};
}

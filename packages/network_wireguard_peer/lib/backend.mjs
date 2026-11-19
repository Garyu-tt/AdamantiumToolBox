import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,appendFile,open,mkdir,rmdir,stat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {digest,validateSnapshot,publicKey,checkTransition} from './contract.mjs';
import {loadManaged,appendManaged} from './managed.mjs';
const exec=promisify(execFile);

export function createBackend({
 binary=process.env.NETWORK_WG_BIN||'wg',
 journal=process.env.NETWORK_WG_JOURNAL||'',
 managedFile=process.env.NETWORK_WG_MANAGED_LEDGER||'',
 interfaceName=process.env.NETWORK_WG_IFACE||'',
 pool=process.env.NETWORK_WG_POOL||'',
 runner=exec
}={}){
 const call=async(args)=>{
  // Never use a shell or allow a caller-supplied executable.
  const r=await runner(binary,args,{shell:false,timeout:4000,maxBuffer:256*1024,windowsHide:true});
  return r.stdout||'';
 };
 const state=async(iface)=>{
  const output=await call(['show',iface,'allowed-ips']);
  if(Buffer.byteLength(output)>256*1024)throw Error('snapshot_too_large');
  const peers=[];
  for(const line of output.trim().split(/\r?\n/).filter(Boolean)){
   const c=line.trim().split(/\s+/);
   if(c.length<2||c.length>258)throw Error('invalid_snapshot');
   publicKey(c[0]);
   const allowedIPs=c.slice(1).join(' ').split(',').map(x=>x.trim()).filter(x=>x&&x!=='(none)');
   peers.push({publicKey:c[0],allowedIPs});
  }
  return validateSnapshot(peers);
 };
 const commit=async(plan,proofs=null,trust=null)=>{
  if(!journal||!journal.startsWith('/')||journal.includes('\0'))throw Error('unconfigured_journal');
  // Journal directory must be pre-provisioned by the operator, never created in request.
  const meta=await stat(dirname(journal));
  if(!meta.isDirectory()||(meta.mode&0o022)!==0)throw Error('unsafe_journal_dir');
  const lock=journal+'.lock';
  await mkdir(lock,{mode:0o700});
  try{
   const log=await readFile(journal,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
   if(Buffer.byteLength(log)>1024*1024)throw Error('journal_full');
   const id=digest(plan);
   const entries=log.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
   if(entries.some(x=>x.id===id))throw Error('operation_replayed');
   // Recheck under the single-writer lock; never trust a stale preflight.
   checkTransition(plan,await state(plan.interface));
   if(managedFile){
    if(!trust||!proofs)throw Error('managed_approvals_required');
    const existing=await loadManaged(managedFile,trust,{interface:interfaceName,pool});
    const prev=existing.managed.find(p=>p.publicKey===plan.peerPublicKey);
    if(plan.operation==='remove'&&prev?.allowedIP!==plan.allowedIP)throw Error('unmanaged_peer');
    if(plan.operation==='add'&&(prev||existing.managed.some(p=>p.allowedIP===plan.allowedIP)))throw Error('managed_peer_conflict');
   }
   const fh=await open(journal,'a',0o600);
   try{
    const meta=await fh.stat();
    if((meta.mode&0o077)!==0)throw Error('unsafe_journal');
    await fh.writeFile(JSON.stringify({id,stage:'attempted',when:Date.now()})+'\n');
    await fh.sync();
   }finally{await fh.close();}
   let failure=null;
   const args=plan.operation==='add'?
      ['set',plan.interface,'peer',plan.peerPublicKey,'allowed-ips',plan.allowedIP]:
      ['set',plan.interface,'peer',plan.peerPublicKey,'remove'];
   try{await call(args);}catch{failure='wg_apply_failed_or_ambiguous';}
   let verified=false;
   try{
    const after=await state(plan.interface);
    const peer=after.find(p=>p.publicKey===plan.peerPublicKey);
    verified=plan.operation==='add'?
      !!peer&&peer.allowedIPs.length===1&&peer.allowedIPs[0]===plan.allowedIP:!peer;
   }catch{failure='readback_failed';}
   let confirmed=verified&&!failure,managed=null;
   if(confirmed&&managedFile){
    try{managed=await appendManaged(managedFile,plan,proofs,trust,{interface:interfaceName,pool});}
    catch{confirmed=false;failure='managed_ledger_write_failed_or_ambiguous';}
   }
   const fh2=await open(journal,'a',0o600);
   try{await fh2.writeFile(JSON.stringify({id,stage:confirmed?'verified':'unverified',when:Date.now()})+'\n');await fh2.sync();}
   finally{await fh2.close();}
   return {verified:confirmed,mode:managedFile?'live_signed_managed':'live_ephemeral',
    recoverable:!!managed,persistent:false,managedRevision:managed?.revision||null,
    reason:confirmed?null:failure||'readback_mismatch',operationId:id};
  }finally{
   await rmdir(lock).catch(()=>{}); // If removal fails, future mutations fail closed.
  }
 };
 return {state,commit};
}

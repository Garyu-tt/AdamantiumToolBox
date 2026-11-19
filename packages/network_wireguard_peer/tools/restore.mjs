#!/usr/bin/env node
import {readFile,mkdir,rmdir,stat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createBackend} from '../lib/backend.mjs';
import {loadManaged} from '../lib/managed.mjs';
import {planRestore,applyRestore} from '../lib/recovery.mjs';
import {digest} from '../lib/contract.mjs';
const exec=promisify(execFile);
async function main(){
 const mode=process.argv[2]||'--preview';
 if(!['--preview','--apply'].includes(mode)||process.argv.length>3)throw Error('invalid_mode');
 const e=process.env,iface=e.NETWORK_WG_IFACE||'',pool=e.NETWORK_WG_POOL||'';
 const journal=e.NETWORK_WG_JOURNAL||'',ledger=e.NETWORK_WG_MANAGED_LEDGER||'';
 const bin=e.NETWORK_WG_BIN||'wg';
 if(!/^[A-Za-z0-9_.=-]{1,15}$/.test(iface)||!pool||!journal.startsWith('/')||!ledger.startsWith('/')||
  !e.NETWORK_WG_SIGNERS_FILE?.startsWith('/'))throw Error('operator_config_missing');
 const trust=JSON.parse(await readFile(e.NETWORK_WG_SIGNERS_FILE,'utf8'));
 const cfg={interface:iface,pool},options={interfaceName:iface,serverIP:e.NETWORK_WG_SERVER_IP};
 const backend=createBackend({binary:bin,journal,managedFile:ledger,interfaceName:iface,pool});
 const query=async()=>{
  const signed=await loadManaged(ledger,trust,cfg);
  const live=await backend.state(iface);
  return {signed,plan:planRestore(signed.managed,live,options)};
 };
 if(mode==='--preview'){
  const {signed,plan}=await query();
  console.log(JSON.stringify({mode:'preview',verifiedSignedEvents:signed.sequence,
   toRestore:plan.missing.length,alreadyPresent:plan.alreadyPresent,
   desiredState:plan.desiredState,persistentStateVerified:true}));
  return;
 }
 if(e.NETWORK_WG_RESTORE_ENABLED!=='1')throw Error('restore_disabled');
 const parent=await stat(dirname(journal));
 if(!parent.isDirectory()||(parent.mode&0o022)!==0)throw Error('unsafe_journal_dir');
 const lock=journal+'.lock';
 await mkdir(lock,{mode:0o700});
 try{
  const {signed,plan}=await query();
  const id='restore:'+digest({iface,head:signed.head});
  // A previous attempt remains a manual-recovery blocker, even if it timed out.
  const fh=await open(journal,constants.O_CREAT|constants.O_APPEND|constants.O_RDWR|constants.O_NOFOLLOW,0o600);
  try{
   const m=await fh.stat();
   if(!m.isFile()||m.nlink!==1||(m.mode&0o077)!==0||m.size>1024*1024)throw Error('unsafe_journal');
   const previous=await fh.readFile({encoding:'utf8'});
   const records=previous.split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{throw Error('corrupt_journal')}});
   if(plan.missing.length===0){console.log(JSON.stringify({mode:'apply',restored:0,verified:true}));return}
   const history=records.filter(x=>x.id===id);
   if(history.length&&history.at(-1).stage!=='verified')throw Error('restore_unverified_attempt');
   if(history.length&&history.filter(x=>x.stage==='attempted').length!==history.filter(x=>x.stage==='verified').length)
    throw Error('restore_ambiguous_history');
   await fh.writeFile(JSON.stringify({id,stage:'attempted',when:Date.now()})+'\n');await fh.sync();
  }finally{await fh.close()}
  const runner=async(args)=>exec(bin,args,{shell:false,timeout:4000,maxBuffer:4096,windowsHide:true});
  const result=await applyRestore({backend,plan,recheck:{managed:signed.managed,options},runner});
  const confirmed=await open(journal,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);
  try{await confirmed.writeFile(JSON.stringify({id,stage:'verified',when:Date.now()})+'\n');await confirmed.sync()}
  finally{await confirmed.close()}
  console.log(JSON.stringify({mode:'apply',verified:true,restored:result.restored,alreadyPresent:result.alreadyPresent}));
 }finally{await rmdir(lock).catch(()=>{})}
}
main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1});

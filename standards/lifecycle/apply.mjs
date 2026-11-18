import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {verifiedPackage} from '../../core/plugin_sources.mjs';
import {catalog} from '../../core/catalog.mjs';
import {readEnvelope,unpack} from '../mesh/store.mjs';
import {trust,planActivation} from './plan.mjs';
import {current,locked,save} from './registry.mjs';
import {probePlugin} from './probe.mjs';
const event=(id,before,after,kind)=>({
 id:randomUUID(),app:id,before,after,kind,at:new Date().toISOString()
});
async function materialize(runtime,hash,id){
 const path=join(runtime,'plugins','installed',hash);
 let ready=false;
 try{ready=(await stat(path)).isDirectory();}
 catch(e){if(e.code!=='ENOENT')throw e;}
 if(!ready){
  const envelope=await readEnvelope(runtime,hash);
  await unpack(runtime,envelope,await trust(runtime));
 }
 return verifiedPackage(runtime,{hash,id});
}
export async function activate(project,runtime,plan,approval=false){
 if(approval!==true)throw Error('explicit_approval_required');
 return locked(runtime,async()=>{
  const check=await planActivation(project,runtime,plan?.hash);
  if(JSON.stringify(check)!==JSON.stringify(plan))throw Error('plan_changed');
  const before=await current(runtime),id=plan.id;
  const {manifest,directory}=await materialize(runtime,plan.hash,id);
  await probePlugin(directory,manifest);
  const previous=before.apps.find(a=>a.id===id)?.hash||null;
  const apps=before.apps.filter(a=>a.id!==id);
  apps.push({id,hash:plan.hash});
  const saved=await save(runtime,before,apps,event(id,previous,plan.hash,'activate'));
  return {schema:'mas-lifecycle-result-1',state:'selected',app:id,
   version:manifest.version,hash:plan.hash,previous,revision:saved.revision,
   probe:'passed',runtime:'supervisor_discovers_next_poll'};
 });
}
export async function rollback(project,runtime,id,approval=false,expectedHash=null){
 if(approval!==true)throw Error('explicit_approval_required');
 if(typeof id!=='string'||!/^[a-z][a-z0-9_-]{1,39}$/.test(id))throw Error('invalid_app_id');
 return locked(runtime,async()=>{
  const doc=await current(runtime),now=doc.apps.find(a=>a.id===id)?.hash||null;
  if(expectedHash&&now!==expectedHash)return {schema:'mas-lifecycle-result-1',state:'stale',app:id};
  const latest=[...(doc.history||[])].reverse().find(e=>e.app===id);
  if(!latest||latest.after!==now||latest.before===now)throw Error('no_rollback_candidate');
  if(latest.before){
   const {manifest}=await verifiedPackage(runtime,{hash:latest.before,id});
   if((await catalog(project)).some(a=>a.id!==id&&a.service.port===manifest.service.port))throw Error('rollback_port_conflict');
   if(manifest.updates.migrations.length)throw Error('rollback_migration_unsupported');
  }
  const apps=doc.apps.filter(a=>a.id!==id);
  if(latest.before)apps.push({id,hash:latest.before});
  const saved=await save(runtime,doc,apps,event(id,now,latest.before,'rollback'));
  return {schema:'mas-lifecycle-result-1',state:'rolled_back',app:id,
   hash:latest.before,previous:now,revision:saved.revision};
 });
}

export async function automaticRollback(project,runtime,id,expectedHash){
 if(!/^[0-9a-f]{64}$/.test(expectedHash||''))throw Error('bad_expected_hash');
 return rollback(project,runtime,id,true,expectedHash);
}

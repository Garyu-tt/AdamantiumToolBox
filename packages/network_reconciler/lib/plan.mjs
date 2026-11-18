import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

const id=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_.:-]{0,95}$/i.test(x);
const cidr=value=>{
 if(typeof value!=='string')return false;
 const x=value.split('/');if(x.length!==2)return false;
 const ver=isIP(x[0]);if(!ver||!/^\d{1,3}$/.test(x[1]))return false;
 return Number(x[1])>=0&&Number(x[1])<=(ver===4?32:128);
};
const canonical=x=>JSON.stringify(x);
const digest=x=>createHash('sha256').update(canonical(x)).digest('hex');
const error=why=>{throw Error(why)};
export function validateSnapshot(snapshot){
 if(!snapshot||snapshot.schema!=='network-reconciler-state-v1'||!id(snapshot.node)||
 !id(snapshot.revision)||!snapshot.current||!Array.isArray(snapshot.current.routes)||
 !Array.isArray(snapshot.current.rules)||!Array.isArray(snapshot.protectedIds)||
 !snapshot.protectedIds.every(id))return error('invalid_snapshot');
 return {node:snapshot.node,revision:snapshot.revision,protectedIds:[...new Set(snapshot.protectedIds)],
  current:normalize(snapshot.current)};
}
export function normalize(input){
 if(!input||!Array.isArray(input.routes)||!Array.isArray(input.rules)||
 input.routes.length>256||input.rules.length>512)throw Error('invalid_configuration');
 const routes=input.routes.map(r=>{
  if(!r||!id(r.id)||!cidr(r.destination)||!id(r.device)||
   (r.via!==null&&r.via!==undefined&&!isIP(r.via)))throw Error('invalid_route');
  return {id:r.id,destination:r.destination,device:r.device,via:r.via||null};
 });
 const rules=input.rules.map(r=>{
  if(!r||!id(r.id)||!cidr(r.source)||!cidr(r.destination)||
   !['tcp','udp','icmp'].includes(r.protocol)||!Number.isInteger(r.port)||
   (r.protocol==='icmp'?r.port!==0:r.port<1||r.port>65535)||
   !['allow','deny'].includes(r.effect))throw Error('invalid_rule');
  return {id:r.id,source:r.source,destination:r.destination,protocol:r.protocol,port:r.port,effect:r.effect};
 });
 for(const list of [routes,rules])if(new Set(list.map(x=>x.id)).size!==list.length)throw Error('duplicate_id');
 routes.sort((a,b)=>a.id.localeCompare(b.id));rules.sort((a,b)=>a.id.localeCompare(b.id));
 return {routes,rules};
}
function changes(kind,before,after){
 const old=new Map(before.map(x=>[x.id,x])),fresh=new Map(after.map(x=>[x.id,x]));
 const ids=[...new Set([...old.keys(),...fresh.keys()])].sort();
 return ids.filter(id=>canonical(old.get(id)||null)!==canonical(fresh.get(id)||null))
  .map(id=>({kind,id,before:old.get(id)||null,after:fresh.get(id)||null}));
}
export function preview(snapshot,desired,expectedRevision){
 const s=validateSnapshot(snapshot);
 if(expectedRevision!==s.revision)throw Error('revision_conflict');
 if(desired?.node!==s.node)throw Error('wrong_node');
 const target=normalize(desired);
 const ops=[...changes('route',s.current.routes,target.routes),...changes('rule',s.current.rules,target.rules)];
 const blocked=ops.filter(op=>s.protectedIds.includes(op.id)).map(op=>'protected_id:'+op.id);
 if(ops.some(op=>op.kind==='rule'&&op.after?.effect==='allow'))blocked.push('bilateral_approvals_required');
 if(ops.some(op=>op.kind==='route'))blocked.push('connectivity_watchdog_and_revert_required');
 if(ops.some(op=>op.kind==='rule'))blocked.push('firewall_snapshot_and_revert_required');
 const core={schema:'network-reconciler-plan-v1',node:s.node,expectedRevision:s.revision,
  currentHash:digest(s.current),desiredHash:digest(target),operations:ops};
 return {...core,planHash:digest(core),blockers:[...new Set(blocked)],operationCount:ops.length,
  appliesChanges:false,allowedToApply:false,previewOnly:true};
}
export function reverse(snapshot,plan){
 const s=validateSnapshot(snapshot);
 const {planHash,blockers,operationCount,appliesChanges,allowedToApply,previewOnly,...core}=plan||{};
 if(core.schema!=='network-reconciler-plan-v1'||!Array.isArray(core.operations)||
  !/^[a-f0-9]{64}$/.test(planHash||'')||digest(core)!==planHash||
  core.node!==s.node||core.expectedRevision!==s.revision||core.currentHash!==digest(s.current))throw Error('stale_or_tampered_plan');
 const reverseOperations=core.operations.slice().reverse().map(({kind,id,before,after})=>({kind,id,before:after,after:before}));
 const data={schema:'network-reconciler-rollback-preview-v1',node:s.node,fromPlanHash:planHash,
  hypotheticalOperations:reverseOperations};
 return {...data,rollbackHash:digest(data),previewOnly:true,appliesChanges:false,
  note:'Hypothetical rollback specification. No changes were applied.'};
}

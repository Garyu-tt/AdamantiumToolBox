// Strict shape gate; semantic consistency is reported by the audit, not hidden.
import {obj,tok,ref,refs,unique,revisions} from './integrity-common.mjs';
const states=['proposed','validated','implemented','verified','published','invalidated','blocked'];
const capStates=['staged','published','revoked'];
const mountStates=['active','hidden','revoked'];
const allUnique=(items,k)=>unique(items.map(x=>x[k]));
export function validSnapshot(p){
 const s=p?.snapshot;
 if(!obj(p)||p.schema!=='forge.integrity.audit.request.v1'||!tok(p.request_id)||
  !obj(s)||s.schema!=='forge.integrity.snapshot.v1'||!tok(s.snapshot_ref)||
  !revisions(s)||!Array.isArray(s.functions)||s.functions.length>256||
  !Array.isArray(s.capabilities)||s.capabilities.length>512||
  !Array.isArray(s.mounts)||s.mounts.length>1024||
  !Array.isArray(s.reverse_index)||s.reverse_index.length>256)return false;
 const f=s.functions,c=s.capabilities,m=s.mounts,r=s.reverse_index;
 if(!allUnique(f,'ref')||!allUnique(c,'ref')||!allUnique(m,'ref')||
  !allUnique(r,'function_ref'))return false;
 for(const x of f){
  if(!obj(x)||!ref(x.ref)||!tok(x.request_ref)||!states.includes(x.state)||
   typeof x.verified!=='boolean'||!refs(x.depends_on,256)||
   !refs(x.capability_refs,32)||!refs(x.mount_refs,64))return false;
  if(x.state==='blocked'&&x.blocker!==undefined&&
   (!obj(x.blocker)||!tok(x.blocker.cause)||!refs(x.blocker.evidence_refs,32)||
    !refs(x.blocker.remedy_refs,16)))return false;
 }
 for(const x of c)if(!obj(x)||!ref(x.ref)||!ref(x.function_ref)||
  !capStates.includes(x.state)||typeof x.verified!=='boolean'||
  (x.handler_ref!==null&&x.handler_ref!==undefined&&!ref(x.handler_ref)))return false;
 for(const x of m)if(!obj(x)||!ref(x.ref)||!ref(x.function_ref)||
  !ref(x.capability_ref)||!mountStates.includes(x.state)||
  typeof x.invokable!=='boolean')return false;
 for(const x of r)if(!obj(x)||!ref(x.function_ref)||!refs(x.dependents,256))return false;
 return true;
}

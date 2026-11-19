// Forge R11: pure integrity checks on *untrusted*, externally supplied graph snapshots.
import {obj,tok,ref} from './access-common.mjs';
export {obj,tok,ref};
export const flags={authoritative:false,authorized:false,executed:false,
 verified:false,graph_mutated:false,ui_updated:false,can_execute:false};
export const issue=(code,path,reason,affected_refs,remedy)=>({
 code,path,reason,affected_refs,remedies:[{action:remedy,risk:'manual-or-external'}],
 evidence:[{source:'supplied-revision-snapshot',trusted:false}]});
export const fail=issues=>({ok:false,consistent:false,issues,steps:[],...flags});
export const unique=a=>new Set(a).size===a.length;
export const refs=(a,max=256)=>Array.isArray(a)&&a.length<=max&&a.every(ref)&&unique(a);
export const keys=['graph_revision','capability_revision','policy_revision','ui_revision'];
export const revisions=o=>obj(o)&&keys.every(k=>tok(o[k]));
export const step=(operation,port,context)=>({operation,port,context,
 authorized:false,executable:false,host_authorization_required:true});
export const typeError=(path,action='re-read-versioned-graph-snapshot')=>
 issue('INVALID_GRAPH_SNAPSHOT',path,'Malformed or ambiguous external graph snapshot',[],action);

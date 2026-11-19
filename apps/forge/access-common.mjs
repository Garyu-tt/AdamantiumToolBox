// Stateless R09 access recipes. Supplied identity, clocks, policies and receipts are UNTRUSTED.
import {obj,tok,ref,problem,intent} from './reactive-common.mjs';
export {obj,tok,ref};
export const flags={authoritative:false,authorized:false,executed:false,
 ui_updated:false,can_execute:false,access_revoked:false,principal_authenticated:false};
export const issue=(code,path,reason,remedy)=>problem(code,reason,path,
 'Revocation or lease cannot become authoritative from an adapter result',remedy);
export const fail=issues=>({ok:false,issues,steps:[],evidence_consistent:false,...flags});
export const step=(operation,port,context)=>intent(operation,port,
 'host-verified-external-provider',context);
export const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
export const refs=(a,max=256)=>Array.isArray(a)&&a.length<=max&&a.every(ref)&&unique(a);
export const exact=(x,y)=>refs(x)&&refs(y)&&x.length===y.length&&
 x.every(v=>y.includes(v));
export const utc=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x?Date.parse(x):null;
export const revisions=x=>obj(x)&&['graph_revision','policy_revision',
 'identity_revision','ui_revision'].every(k=>tok(x[k]));

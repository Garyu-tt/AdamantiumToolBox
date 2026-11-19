// Forge R10: pure diagnostic recipes. The host owns all state, policy and execution.
import {obj,tok,ref,refs,issue,step} from './access-common.mjs';
import {validateIncident} from './incident.mjs';
export {obj,tok,ref,refs,issue,step};
export const flags={authoritative:false,authorized:false,executed:false,
 attempted:false,verified:false,cleared:false,can_execute:false};
export const fail=issues=>({ok:false,issues,steps:[],...flags});
export const incidentReport=i=>validateIncident(i);
export const keys=['graph_revision','policy_revision','incident_revision'];
export const revs=s=>obj(s)&&keys.every(k=>tok(s[k]));
export const unique=xs=>new Set(xs).size===xs.length;
export const tokens=(a,max=24)=>Array.isArray(a)&&a.length>0&&a.length<=max&&a.every(tok)&&unique(a);
export const receiptIssue=(name,why)=>issue('UNVERIFIED_'+name.toUpperCase(),
 'evidence.'+name,'External '+name+' evidence '+why,
 'inspect-authoritative-'+name+'-readback-and-reconcile');

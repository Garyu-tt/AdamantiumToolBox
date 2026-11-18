// Common bounded structural helpers; no graph state.
export const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
export const semver=/^\d+\.\d+\.\d+$/;
export const limits={functions:256,groups:256,depth:64,edges:8192};
export const issue=(code,path,reason,actions=['inspect-input'])=>({code,path,reason,
 evidence:{path,check:code},impact:'Cannot create a safe composition or impact plan',
 remedies:actions.map(action=>({action,risk:'manual'}))});
export const reject=errors=>({ok:false,errors,executed:false,persisted:false,published:false,
 authoritative:false,provider_bound:false,can_execute:false});
export const sorted=arr=>arr.sort((a,b)=>a.localeCompare(b));
export const cleanRevision=r=>typeof r==='string'&&r.length>0&&r.length<=128;

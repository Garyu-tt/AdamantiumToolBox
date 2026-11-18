// Stateless shared contract checks for distributed projection.
export const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const token=x=>typeof x==='string'&&x.length>0&&x.length<=128;
export const ref=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
export const version=x=>typeof x==='string'&&/^\d+\.\d+\.\d+$/.test(x);
export const MAX={participants:256,functions:256,edges:8192,ui:768};
export const issue=(code,path,reason,impact,remedies,observed)=>({code,reason,
 evidence:{path,...(observed===undefined?{}:{observed})},impact,
 remedies:remedies.map(action=>({action,mode:'external-only',automatic:false}))});
export const reject=errors=>({ok:false,issues:errors,executed:false,authorized:false,
 provider_bound:false,authoritative:false,ui_visible:false,can_execute:false});
export const targets=x=>obj(x)&&token(x.node_ref)&&token(x.provider_ref)&&ref(x.action_id)&&version(x.contract_version);
export const claimedReachable=x=>x.status==='reachable'&&x.primary===true&&
 x.identity_pinned===true&&x.policy_allowed===true&&x.can_invoke===true;
export const safe=(id,contract,operation,targets,gate)=>({id,contract,operation,
 targets,gate,executable:false,authorized:false,provider_bound:false,
 retry_policy:'readback-before-any-write-retry'});
export const sortRefs=x=>[...x].sort((a,b)=>a.localeCompare(b));

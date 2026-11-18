// R02 incident validation: explanation, evidence, affected functions, remedies.
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ref=/^[a-z][a-z0-9_-]{1,39}(?:\.[a-z][a-z0-9_-]{1,39})+$/;
const fault=(code,path,reason,remedies=['correct-input'])=>({code,path,reason,
 evidence:{path,check:code},impact:'Cannot authorize this plan',
 remedies:remedies.map(action=>({action,safety:'manual-input'}))});
export function validateIncident(p){
 const errors=[];
 if(!object(p)||typeof p.incident_id!=='string'||!p.incident_id.trim())
  errors.push(fault('MISSING_INCIDENT_ID','incident_id','Stable incident id required'));
 if(!object(p)||typeof p.node_ref!=='string'||!ref.test(p.node_ref))
  errors.push(fault('MISSING_NODE_REF','node_ref','Affected function reference required'));
 if(!object(p?.cause)||typeof p.cause.code!=='string'||!p.cause.code.trim()||
    typeof p.cause.explanation!=='string'||!p.cause.explanation.trim())
  errors.push(fault('UNEXPLAINED_BLOCKER','cause','An explicit cause code and explanation are mandatory',
  ['inspect-provider-errors','collect-diagnostic-evidence']));
 if(!Array.isArray(p?.evidence)||!p.evidence.length||p.evidence.some(x=>!object(x)||typeof x.ref!=='string'||!x.ref.trim()))
  errors.push(fault('MISSING_EVIDENCE','evidence','At least one evidence reference is required',
  ['collect-provider-proof']));
 if(!object(p?.impact)||!Array.isArray(p.impact.direct)||!p.impact.direct.length||!p.impact.direct.includes(p.node_ref))
  errors.push(fault('MISSING_IMPACT','impact','Directly affected nodes must be recorded',
  ['query-reverse-dependencies']));
 if(!Array.isArray(p?.remedies)||!p.remedies.length||p.remedies.some(r=>
   !object(r)||typeof r.action!=='string'||!r.action.trim()||!['safe','permissioned','manual'].includes(r.risk)))
  errors.push(fault('MISSING_REMEDIES','remedies','Provide actionable remedies with risk classification',
  ['propose-reversible-fixes','escalate-with-specific-permission']));
 return {ok:errors.length===0,errors,diagnosed:errors.length===0,
  attempted:false,verified:false,cleared:false,validation_level:'structural-only'};
}

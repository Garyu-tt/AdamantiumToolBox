import {validate,digest} from './validate.mjs';
export function inspectBatch(input){
 if(!input||!Array.isArray(input.records)||input.records.length>2000)throw Error('invalid_batch');
 const issues=[],accepted=[],quarantine=[],ids=new Set(),candidates=[];
 for(const [index,r] of input.records.entries()){
  const problems=validate(r);
  if(r&&ids.has(r.id))problems.push('duplicate_id');
  if(r&&typeof r.id==='string')ids.add(r.id);
  const description={index,id:typeof r?.id==='string'?r.id:null,issues:problems};
  if(problems.length){quarantine.push(description);continue;}
  accepted.push({id:r.id,kind:r.kind,payload_sha256:digest(r.payload),
   recorded_at:r.recorded_at,observed_at:r.observed_at,source:r.source});
  candidates.push(r);
 }
 for(const r of candidates){
  const missing=r.refs.filter(x=>!ids.has(x));
  if(missing.length)issues.push({id:r.id,code:'unresolved_references',count:missing.length,
   note:'Cross-batch references require global reconciliation'});
 }
 const manifest={schema:'noosphere-migration-inspection-1',input:input.records.length,
  accepted:accepted.length,quarantined:quarantine.length};
 return {manifest,accepted,quarantine,issues,
  batch_sha256:digest(accepted),committed:false,sourceModified:false};
}

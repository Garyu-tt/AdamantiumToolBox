import {createHash} from 'node:crypto';
const identity=/^[\w.:/@-]{1,240}$/u;
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
export const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function validate(r){
 const issues=[];
 if(!r||typeof r!=='object'||Array.isArray(r))return ['invalid_object'];
 if(!identity.test(r.id||''))issues.push('invalid_id');
 if(!identity.test(r.kind||''))issues.push('invalid_kind');
 for(const field of ['recorded_at','observed_at'])
  if(!date(r[field]))issues.push('invalid_'+field);
 if(r.updated_at!==undefined&&!date(r.updated_at))issues.push('invalid_updated_at');
 for(const field of ['valid_from','valid_to'])
  if(r[field]!=null&&!date(r[field]))issues.push('invalid_'+field);
 if(date(r.valid_from)&&date(r.valid_to)&&Date.parse(r.valid_from)>Date.parse(r.valid_to))
  issues.push('invalid_validity_interval');
 if(!r.payload||typeof r.payload!=='object'||Array.isArray(r.payload))issues.push('invalid_payload');
 if(!Array.isArray(r.refs)||r.refs.some(x=>!identity.test(x)))issues.push('invalid_refs');
 if(typeof r.source!=='string'||!r.source.trim())issues.push('missing_provenance');
 if(r.payload_sha256!==undefined&&r.payload_sha256!==digest(r.payload))issues.push('payload_hash_mismatch');
 return issues;
}

const typed=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const hash=/^[0-9a-f]{64}$/i;
const bounded=(x,n=256)=>typeof x==='string'&&x.length>0&&x.length<=n;
export async function activate({use}){
 const temporal=use('memory.temporal.validator');
 const provenance=use('memory.provenance.validator');
 if(!temporal||!provenance)throw Error('validators_unavailable');
 function validate(o){
  if(!o||typeof o!=='object'||Array.isArray(o))return {valid:false,issues:['invalid_envelope']};
  const issues=[];
  if(!bounded(o.id,128))issues.push('invalid_id');
  if(!typed.test(o.type||''))issues.push('invalid_type');
  if(!Number.isSafeInteger(o.schema_version)||o.schema_version<1)issues.push('invalid_schema_version');
  if(!bounded(o.payload_ref,2048))issues.push('invalid_payload_ref');
  if(!hash.test(o.content_hash||''))issues.push('invalid_content_hash');
  issues.push(...temporal.check(o),...provenance.check(o));
  return {schema:'noosphere-envelope-v1',valid:issues.length===0,issues};
 }
 return {actions:{'noosphere.validate':p=>validate(p?.envelope)}};
}

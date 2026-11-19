const bounded=s=>typeof s==='string'&&s.length>0&&s.length<=256;
export async function activate(){
 return {services:{'memory.provenance.validator':{
  check(o){
   const source=o.source;
   if(!source||typeof source!=='object'||Array.isArray(source))return ['missing_source'];
   const issues=[];
   if(!bounded(source.system))issues.push('invalid_source_system');
   if(!bounded(source.original_id))issues.push('invalid_source_id');
   return issues;
  }
 }}};
}

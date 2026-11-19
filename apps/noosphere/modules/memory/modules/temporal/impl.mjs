const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const valid=t=>typeof t==='string'&&iso.test(t)&&Number.isFinite(Date.parse(t));
export async function activate(){
 return {services:{'memory.temporal.validator':{
  check(o){
   const issues=[];
   for(const k of ['recorded_at','observed_at','updated_at']){
    if(!valid(o[k]))issues.push('invalid_'+k);
   }
   for(const k of ['valid_from','valid_to']){
    if(o[k]!=null&&!valid(o[k]))issues.push('invalid_'+k);
   }
   if(valid(o.valid_from)&&valid(o.valid_to)&&Date.parse(o.valid_from)>Date.parse(o.valid_to))
    issues.push('invalid_valid_interval');
   if(valid(o.recorded_at)&&valid(o.updated_at)&&Date.parse(o.updated_at)<Date.parse(o.recorded_at))
    issues.push('updated_before_recorded');
   return issues;
  }
 }}};
}

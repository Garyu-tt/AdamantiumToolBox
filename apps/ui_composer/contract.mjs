const id=/^[a-z][a-z0-9_-]{0,47}$/;
const roles=new Set(['field','action','status','output','collection','heading']);
export function validateSchema(schema){
 if(schema?.schema!=='mas-ui-schema-1'||typeof schema.app!=='string'||
  !id.test(schema.app)||!Array.isArray(schema.elements)||
  !schema.elements.length||schema.elements.length>96||
  (schema.groups!==undefined&&!Array.isArray(schema.groups))||
  (schema.groups||[]).length>32)return false;
 const seen=new Set(),groups=new Set();
 for(const g of schema.groups||[]){
  if(!g||!id.test(g.id)||groups.has(g.id)||typeof g.title!=='string'||
   g.title.length>90||!['full','card','sidebar',undefined].includes(g.width)||
   (g.priority!==undefined&&(!Number.isInteger(g.priority)||Math.abs(g.priority)>1000)))return false;
  groups.add(g.id);
 }
 for(const e of schema.elements){
  if(!e||!id.test(e.id)||seen.has(e.id)||!roles.has(e.role)||
   (e.label!==undefined&&(typeof e.label!=='string'||e.label.length>90))||
   (e.group!==undefined&&!groups.has(e.group)))return false;
  seen.add(e.id);
 }
 return true;
}
export function validatePlan(plan,schema){
 if(!validateSchema(schema)||plan?.schema!=='mas-ui-plan-1'||
  plan.app!==schema.app||plan.mode!=='automatic'||
  !Array.isArray(plan.sections)||!plan.sections.length)return false;
 const ids=new Set(schema.elements.map(e=>e.id)),seen=new Set(),groups=new Set();
 for(const section of plan.sections){
  if(!section||!id.test(section.id)||groups.has(section.id)||
   typeof section.title!=='string'||section.title.length>90||
   !['full','card','sidebar'].includes(section.width)||
   !Array.isArray(section.items)||!section.items.length)return false;
  groups.add(section.id);
  for(const item of section.items){
   if(typeof item!=='string'||!ids.has(item)||seen.has(item))return false;
   seen.add(item);
  }
 }
 return seen.size===ids.size;
}

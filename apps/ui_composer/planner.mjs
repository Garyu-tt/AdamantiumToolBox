import {validateSchema,validatePlan} from './contract.mjs';
const defaults={
 field:{group:'work',title:'Рабочая область',width:'full',priority:10},
 action:{group:'work',title:'Рабочая область',width:'full',priority:10},
 status:{group:'status',title:'Состояние',width:'card',priority:20},
 output:{group:'results',title:'Результат',width:'card',priority:30},
 collection:{group:'history',title:'История',width:'card',priority:40},
 heading:{group:'history',title:'История',width:'card',priority:40}
};
export function planLayout(schema,requestedMode='automatic'){
 if(!validateSchema(schema))throw Error('invalid_ui_schema');
 if(requestedMode!=='automatic')throw Error('composer_mode_unavailable');
 const declared=new Map((schema.groups||[]).map(g=>[g.id,g]));
 const sections=new Map();
 for(const e of schema.elements){
  const hint=defaults[e.role],source=e.group?declared.get(e.group):null;
  const group=e.group||hint.group;
  if(!sections.has(group))sections.set(group,{
   id:group,title:source?.title??hint.title,width:source?.width||hint.width,
   priority:source?.priority??hint.priority,items:[]});
  sections.get(group).items.push(e.id);
 }
 const ordered=[...sections.values()].sort((a,b)=>a.priority-b.priority);
 const result={schema:'mas-ui-plan-1',app:schema.app,mode:'automatic',
  sections:ordered.map(({priority,...section})=>section)};
 if(!validatePlan(result,schema))throw Error('invalid_planner_output');
 return result;
}

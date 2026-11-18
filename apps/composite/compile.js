export function compile(spec,graph){
 if(!spec||spec.schema!=='mas-composite-1'||!Array.isArray(spec.groups)||spec.groups.length>30)
  throw Error('invalid_composition');
 if(!graph||!Array.isArray(graph.nodes))throw Error('graph_unavailable');
 const available=new Set(graph.nodes.filter(n=>n.type==='action').map(n=>n.id));
 const ids=new Set(),diagnostics=[],groups=[];
 for(const group of spec.groups){
  if(typeof group.id!=='string'||!/^[a-z][\w-]{0,63}$/.test(group.id)||ids.has(group.id))
   throw Error('invalid_group');
  ids.add(group.id);
  if(!Array.isArray(group.items)||group.items.length>100)throw Error('invalid_items');
  const items=[];
  for(const item of group.items){
   if(typeof item.action!=='string'||typeof item.label!=='string'||item.label.length>120)
    throw Error('invalid_action_binding');
   if(!available.has(item.action)){
    diagnostics.push({group:group.id,action:item.action,reason:'unavailable_or_unauthorized'});
    continue;
   }
   items.push({label:item.label,action:item.action,params:item.params||{}});
  }
  groups.push({id:group.id,title:String(group.title||group.id).slice(0,120),items});
 }
 return {schema:'mas-composite-plan-1',groups,diagnostics,executesActions:false};
}

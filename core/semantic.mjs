import {loadFrontend,validateFrontend} from './frontend.mjs';
const valid=/^component:\/\/(f\.[a-z0-9._-]{1,65})$/;
const writable={tab:['title'],button:['title','x','y','binding'],label:['title','x','y'],connector:['title','x','y','binding']};
const key=(target)=>{const match=valid.exec(target||'');if(!match)throw Error('invalid_target');return match[1];};
export function semanticGraph(front,back){
 const nodes=front.frontend.nodes.map(n=>({ref:'component://'+n.id,kind:'frontend.'+n.kind,title:n.title}));
 nodes.push(...back.nodes.map(n=>({ref:'capability://'+n.id,kind:'backend.'+n.type,title:n.title||n.id})));
 const edges=front.frontend.edges.map(e=>({from:'component://'+e.from,to:'component://'+e.to,type:e.type}));
 edges.push(...front.bridge.edges.map(e=>({from:'component://'+e.from,to:'capability://'+e.to,type:e.type})));
 return {schema:'mas-semantic-ir-1',revision:front.etag,nodes,edges};
}
export function describe(target,front,back){
 const id=key(target),node=front.frontend.nodes.find(n=>n.id===id);
 if(!node)throw Error('object_not_found');
 const binding=front.bridge.edges.find(e=>e.from===id)?.to||'';
 const users=front.frontend.edges.filter(e=>e.to===id).map(e=>e.from);
 const children=front.frontend.edges.filter(e=>e.from===id).map(e=>e.to);
 const action=back.nodes.find(n=>n.id===binding&&n.type==='action');
 return {schema:'mas-object-1',ref:target,kind:node.kind,properties:{...node,binding},
  writable:writable[node.kind]||[],revision:front.etag,relations:{parents:users,children,action:action?.id||null},
  availability:!binding||Boolean(action)};
}
export function mutate(front,back,request){
 if(request?.operation!=='modify')throw Error('unsupported_operation');
 const id=key(request.target),node=front.frontend.nodes.find(n=>n.id===id);
 if(!node)throw Error('object_not_found');
 const property=request.change?.property,value=request.change?.value;
 if(!writable[node.kind]?.includes(property))throw Error('readonly_property');
 const doc=structuredClone({frontend:front.frontend,bridge:front.bridge});
 const updated=doc.frontend.nodes.find(n=>n.id===id);
 let prior;
 if(property==='binding'){
  prior=doc.bridge.edges.find(e=>e.from===id)?.to||'';
  if(typeof value!=='string'||value.length>130)throw Error('invalid_binding');
  if(value&&!back.nodes.some(n=>n.id===value&&n.type==='action'))throw Error('backend_capability_unavailable');
  doc.bridge.edges=doc.bridge.edges.filter(e=>e.from!==id);
  if(value)doc.bridge.edges.push({from:id,to:value,type:'invokes'});
 }else{
  prior=updated[property];
  if(property==='title'&&(typeof value!=='string'||!value.trim()||value.length>100))throw Error('invalid_title');
  if(['x','y'].includes(property)&&(!Number.isInteger(value)||value<0||value>2500))throw Error('invalid_position');
  updated[property]=value;
 }
 validateFrontend(doc);
 const dependents=doc.frontend.edges.filter(e=>e.from===id||e.to===id).map(e=>e.from===id?e.to:e.from);
 if(property==='binding'&&value)dependents.push(value);
 return {doc,diff:{target:request.target,property,before:prior,after:value},
  affected:[...new Set(dependents)],checks:['valid_schema','immutable_identity','backend_binding_valid','permissions_unchanged']};
}

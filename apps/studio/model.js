export const makeId=kind=>'f.'+kind+'.'+crypto.randomUUID().replaceAll('-','').slice(0,12);
export function tabs(doc){return doc.frontend.nodes.filter(n=>n.kind==='tab');}
export function controls(doc,tab){
 const ids=new Set(doc.frontend.edges.filter(e=>e.type==='contains'&&e.from===tab).map(e=>e.to));
 return doc.frontend.nodes.filter(n=>ids.has(n.id)&&n.kind!=='tab');
}
export function bound(doc,nodeId){
 return doc.bridge.edges.find(e=>e.type==='invokes'&&e.from===nodeId)?.to||'';
}
export function connect(doc,nodeId,action){
 doc.bridge.edges=doc.bridge.edges.filter(e=>e.from!==nodeId);
 if(action)doc.bridge.edges.push({from:nodeId,to:action,type:'invokes'});
}
export function addTab(doc,title){
 const id=makeId('tab');doc.frontend.nodes.push({id,kind:'tab',title});return id;
}
export function addControl(doc,tab,kind,title){
 const id=makeId(kind);
 doc.frontend.nodes.push({id,kind,title,x:25,y:25+controls(doc,tab).length*64});
 doc.frontend.edges.push({from:tab,to:id,type:'contains'});return id;
}
export function remove(doc,id){
 const ids=new Set([id]);
 if(doc.frontend.nodes.find(n=>n.id===id)?.kind==='tab')
  for(const e of doc.frontend.edges)if(e.from===id)ids.add(e.to);
 doc.frontend.nodes=doc.frontend.nodes.filter(n=>!ids.has(n.id));
 doc.frontend.edges=doc.frontend.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));
 doc.bridge.edges=doc.bridge.edges.filter(e=>!ids.has(e.from));
}
export function backendActions(api){
 return api.graph().nodes.filter(n=>n.type==='action');
}

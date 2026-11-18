import {bound} from './model.js';
const el=(tag,label,cls)=>{const e=document.createElement(tag);if(label!==undefined)e.textContent=label;if(cls)e.className=cls;return e;};
export function showGraph(host,doc,backend){
 host.replaceChildren();
 const wrap=el('div',undefined,'studio-pair'),left=el('div',undefined,'studio-pane'),right=el('div',undefined,'studio-pane');
 const bridge=el('div',undefined,'studio-links');
 left.append(el('h3','Frontend Graph'));
 right.append(el('h3','Backend Graph'));
 bridge.append(el('h3','Binding Graph'));
 for(const n of doc.frontend.nodes){
  const entry=el('div',n.id+' · '+n.kind+' · '+n.title,'studio-graph-node');left.append(entry);
 }
 for(const n of backend.nodes){
  const entry=el('div',n.id+' · '+n.type,'studio-graph-node');right.append(entry);
 }
 for(const e of doc.bridge.edges){
  const target=backend.nodes.find(n=>n.id===e.to&&n.type==='action');
  const line=el('div',e.from+' → '+e.to,target?'studio-binding':'studio-binding missing');
  if(target)bridge.append(line);
 }
 if(!doc.bridge.edges.some(e=>backend.nodes.some(n=>n.id===e.to)))bridge.append(el('p','Нет доступных привязок'));
 wrap.append(left,bridge,right);host.append(wrap);
}

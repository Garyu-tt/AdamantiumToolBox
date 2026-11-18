import {projectGraph,filterGraph,impacted} from './model.js';
import {renderGraph} from './canvas.js';
const add=(tag,parent,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
export async function mount(host,api){
 const style=add('link',host);style.rel='stylesheet';style.href=new URL('./view.css',import.meta.url).href;
 const section=add('section',host);section.className='gm-root';
 add('h2',section,'Mechanicus Graph Manager');
 const controls=add('div',section);controls.className='gm-toolbar';
 const search=add('input',controls);search.placeholder='Найти узел или блокер';search.setAttribute('aria-label','Поиск');
 const layers=add('select',controls);layers.setAttribute('aria-label','Слой графа');
 const toggle=add('label',controls,'Только блокеры '),checkbox=add('input',toggle);checkbox.type='checkbox';
 const refresh=add('button',controls,'Обновить'),exportButton=add('button',controls,'Экспорт JSON');
 const status=add('small',section),workspace=add('div',section);workspace.className='gm-workspace';
 const canvas=add('div',workspace);canvas.className='gm-viewport';
 const details=add('aside',workspace);details.className='gm-details';
 let graph=projectGraph(api.graph()),selected='',last='',timer;
 const redraw=()=>{
  const f=filterGraph(graph,{query:search.value,layer:layers.value,blockers:checkbox.checked});
  status.textContent=`${graph.nodes.length} узлов · ${graph.edges.length} связей · `+
   `${graph.missing.length} отсутствующих концов · ${graph.cycles.length} циклов`;
  renderGraph(canvas,f,selected,id=>{selected=id;redraw();});
  details.replaceChildren();const n=graph.nodes.find(x=>x.id===selected);
  if(!n){add('p',details,'Выберите узел графа');return;}
  add('h3',details,n.title);add('small',details,n.id);
  for(const [label,value] of Object.entries({Тип:n.kind,Статус:n.status,Владелец:n.owner,
   Причина:n.reason,Ответственный:n.responsible,Диагностика:n.diagnostic,Исправление:n.remediation}))
   if(value!==null&&value!==undefined)add('p',details,label+': '+String(value).slice(0,600));
  add('p',details,'Влияние через depends: '+(impacted(graph,n.id).join(', ')||'не обнаружено'));
  add('pre',details,JSON.stringify(n.source||{},null,2));
 };
 const sync=()=>{
  const raw=api.graph(),encoded=JSON.stringify(raw);
  if(encoded!==last){last=encoded;graph=projectGraph(raw);selected=graph.nodes.some(n=>n.id===selected)?selected:'';
   const kinds=['all',...new Set(graph.nodes.map(n=>n.kind))];
   const current=layers.value;layers.replaceChildren();
   for(const kind of kinds){const opt=add('option',layers,kind);opt.value=kind;}
   layers.value=kinds.includes(current)?current:'all';redraw();}
 };
 for(const element of [search,layers,checkbox])element.addEventListener('input',redraw);
 refresh.onclick=sync;
 exportButton.onclick=()=>{
  const blob=new Blob([JSON.stringify(graph,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=add('a',section);a.href=url;
  a.download='mechanicus-graph-snapshot.json';a.click();a.remove();URL.revokeObjectURL(url);
 };
 sync();timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}sync();},2500);
 return {dispose:()=>clearInterval(timer)};
}
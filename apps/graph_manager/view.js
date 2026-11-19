import {filterGraph,impacted} from './model.js';
import {federate,discoverTaskReader} from './federation.js';
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
 const codeButton=add('button',controls,'Карта файлов'),taskButton=add('button',controls,'Граф задач');
 const status=add('small',section),feedback=add('small',section),workspace=add('div',section);workspace.className='gm-workspace';
 const canvas=add('div',workspace);canvas.className='gm-viewport';
 const details=add('aside',workspace);details.className='gm-details';
 let code=null,tasks=null,taskAction=null,graph=federate(api.graph()),selected='',last='',timer;
 const redraw=()=>{
  const filtered=filterGraph(graph,{query:search.value,layer:layers.value,blockers:checkbox.checked});
  const nodes=filtered.nodes.slice(0,160),ids=new Set(nodes.map(n=>n.id));
  const bounded={...filtered,nodes,edges:filtered.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};
  status.textContent=`${graph.nodes.length} узлов · ${graph.edges.length} связей · `+
   `${graph.missing.length} неизвестных связей · ${graph.cycles.length} циклов`+
   (filtered.nodes.length>nodes.length?` · показано ${nodes.length}/${filtered.nodes.length}`:'');
  renderGraph(canvas,bounded,selected,id=>{selected=id;redraw();});
  details.replaceChildren();const n=graph.nodes.find(x=>x.id===selected);
  if(!n){add('p',details,'Выберите узел графа');return;}
  add('h3',details,n.title);add('small',details,n.id);
  for(const [label,value] of Object.entries({Тип:n.kind,Статус:n.status,Владелец:n.owner,
   Причина:n.reason,Ответственный:n.responsible,Диагностика:n.diagnostic,Исправление:n.remediation}))
   if(value!==null&&value!==undefined)add('p',details,label+': '+String(value).slice(0,600));
  add('p',details,'Зависимые: '+(impacted(graph,n.id).slice(0,30).join(', ')||'не обнаружено'));
  add('pre',details,JSON.stringify(n.source||{},null,2));
 };
 const sync=(force=false)=>{
  const raw=api.graph(),encoded=JSON.stringify(raw);
  const discovered=discoverTaskReader(raw);
  if(discovered!==taskAction){taskAction=discovered;tasks=null;force=true;}
  taskButton.disabled=!taskAction;codeButton.disabled=typeof api.readCodeGraph!=='function';
  if(force||encoded!==last){last=encoded;graph=federate(raw,{code,tasks,taskAction});
   selected=graph.nodes.some(n=>n.id===selected)?selected:'';
   const kinds=['all',...new Set(graph.nodes.map(n=>n.kind))],current=layers.value;
   layers.replaceChildren();for(const kind of kinds){const opt=add('option',layers,kind);opt.value=kind;}
   layers.value=kinds.includes(current)?current:'all';redraw();}
 };
 codeButton.onclick=async()=>{
  codeButton.disabled=true;
  try{code=await api.readCodeGraph();feedback.textContent='CodeGraph загружен, статические зависимости';sync(true);}
  catch(e){feedback.textContent='CodeGraph недоступен: '+String(e.message).slice(0,120);}
  finally{codeButton.disabled=typeof api.readCodeGraph!=='function';}
 };
 taskButton.onclick=async()=>{
  const action=discoverTaskReader(api.graph());if(!action)return;
  taskButton.disabled=true;
  try{const result=await api.call(action,{limit:200});if(!Array.isArray(result))throw Error('invalid_task_snapshot');
   tasks=result;feedback.textContent='Снимок задач загружен; это не подписка';sync(true);}
  catch(e){feedback.textContent='Задачи недоступны: '+String(e.message).slice(0,120);}
  finally{taskButton.disabled=!discoverTaskReader(api.graph());}
 };
 for(const element of [search,layers,checkbox])element.addEventListener('input',redraw);
 refresh.onclick=()=>sync(true);
 exportButton.onclick=()=>{
  const blob=new Blob([JSON.stringify(graph,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=add('a',section);a.href=url;
  a.download='mechanicus-graph-snapshot.json';a.click();a.remove();URL.revokeObjectURL(url);
 };
 sync(true);timer=setInterval(()=>{if(!host.isConnected){clearInterval(timer);return;}sync();},2500);
 return {dispose:()=>clearInterval(timer)};
}

const launcher=document.querySelector('#launcher'),desktop=document.querySelector('#desktop');
const status=document.querySelector('#status'),tasks=document.querySelector('#tasks');
const q=new URLSearchParams(location.search),standalone=q.get('app');
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('token')){sessionStorage.setItem('ada-token',fragment.get('token'));history.replaceState(null,'',location.pathname+location.search);}
import {systemViews} from '/shell/builtin.js';
import {drawNavigation} from '/shell/navigation.js';
import {bindWorkspace} from '/shell/workspace.js';
const token=sessionStorage.getItem('ada-token')||'';
let graph={nodes:[],edges:[]},z=10;const windows=new Map();
const builtins=systemViews(desktop,rpc,()=>graph);
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
async function rpc(url,data){
 const response=await fetch(url,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'HTTP '+response.status);return result;
}
function focus(win){win.style.zIndex=++z;}
function drag(bar,win){
 bar.addEventListener('pointerdown',ev=>{
  if(ev.target.closest('button')||standalone)return;
  const rect=win.getBoundingClientRect(),dx=ev.clientX-rect.left,dy=ev.clientY-rect.top;
  bar.setPointerCapture(ev.pointerId);focus(win);
  const move=e=>{const area=desktop.getBoundingClientRect();win.style.left=Math.max(0,e.clientX-area.left-dx)+'px';win.style.top=Math.max(0,e.clientY-area.top-dy)+'px';};
  const stop=()=>{bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',stop);};
  bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',stop);
 });
}
function icon(view){const img=document.createElement('img');
 img.src=view.iconUrl||'/icons/'+encodeURIComponent(view.icon||'workbench')+'.svg';
 img.alt='';return img;}
async function openApp(view){
 if(windows.has(view.id))return focus(windows.get(view.id));
 const win=el('section',undefined,'window');win.dataset.entry=view.entry;win.style.left=(25+windows.size*24)+'px';win.style.top=(25+windows.size*19)+'px';
 const bar=el('div',undefined,'titlebar'),name=el('strong');name.append(icon(view),el('span',view.title));
 const close=el('button','×');close.setAttribute('aria-label','Закрыть');
 close.onclick=()=>{win.remove();windows.delete(view.id);paintTasks();};
 bar.append(name,close);const content=el('div',undefined,'app-content');win.append(bar,content);desktop.append(win);
 windows.set(view.id,win);focus(win);drag(bar,win);paintTasks();
 try{
  const app=await import(view.entry);
  await app.mount(content,{
   call:async(action,params={})=>{
    if(!graph.nodes.some(n=>n.type==='action'&&n.id===action))throw Error('Функция не представлена в API-графе');
    return (await rpc('/api/invoke',{action,params})).result;
   },
   graph:()=>structuredClone(graph)
  });
 }catch(e){content.replaceChildren(el('p',e.message,'error'));}
}
function paintTasks(){
 tasks.replaceChildren();
 for(const [id,win] of windows){const b=el('button',id);b.onclick=()=>focus(win);tasks.append(b);}
}
async function refresh(){
 try{
  graph=await rpc('/api/graph');const views=graph.nodes.filter(n=>n.type==='view');
  if(!standalone)status.textContent=views.length+' приложений · '+graph.nodes.length+' API';
  const ids=new Set(views.map(v=>v.id));
  const reload=[];
  for(const [id,win] of windows){
   const now=views.find(v=>v.id===id);
   if(!ids.has(id)||now?.entry!==win.dataset.entry){
    win.remove();windows.delete(id);if(now)reload.push(now);
   }
  }
  for(const view of reload)await openApp(view);
  launcher.replaceChildren();
  if(!standalone){
   const tree=await rpc('/api/navigation');
   const mounted=await bindWorkspace(views,tree,{
    desktop,taskbar:document.querySelector('footer'),openApp,icon,system:builtins,status
   });
   if(!mounted)drawNavigation(launcher,tree,graph,openApp);
  }
  if(standalone){document.body.classList.add('standalone');const v=views.find(v=>v.id===standalone);if(v)await openApp(v);else status.textContent='Приложение недоступно';}
  if(!standalone)status.textContent=views.length+' приложений · '+graph.nodes.length+' API';
  paintTasks();
 }catch(e){status.textContent='Ошибка: '+e.message;}
}
document.querySelector('#refresh').onclick=refresh;
if(!token)status.textContent='Требуется токен запуска';else await refresh();
setInterval(refresh,12000);

document.querySelector('#backend-graph').onclick=builtins.graph;document.querySelector('#code-map').onclick=builtins.codemap;

document.querySelector('#mesh-status').onclick=builtins.mesh;

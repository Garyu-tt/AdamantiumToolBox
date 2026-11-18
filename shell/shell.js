const launcher=document.querySelector('#launcher'),desktop=document.querySelector('#desktop');
const status=document.querySelector('#status'),tasks=document.querySelector('#tasks');
const q=new URLSearchParams(location.search),standalone=q.get('app');
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('token')){sessionStorage.setItem('ada-token',fragment.get('token'));history.replaceState(null,'',location.pathname+location.search);}
import {systemViews} from '/shell/builtin.js';
import {drawNavigation} from '/shell/navigation.js';
import {createIconAssets} from '/shell/icon_assets.js';
import {createWindowManager} from '/shell/window_manager.js';
import {windowLayoutUI} from '/shell/window_layout_ui.js';
import windowLayouts from '/shell/window-layouts.js';
const token=sessionStorage.getItem('ada-token')||'';
let graph={nodes:[],edges:[]};const windows=new Map(),graphListeners=new Map();
const manager=createWindowManager(desktop,windowLayouts,()=>paintTasks());
const layoutButton=document.createElement('button');
layoutButton.textContent='▦ Окна';layoutButton.title='Сетка и размеры окон';
document.querySelector('.controls').insertBefore(layoutButton,status);
windowLayoutUI(layoutButton,manager,windowLayouts);
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
async function rpc(url,data){
 const response=await fetch(url,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'HTTP '+response.status);return result;
}
const iconAssets=createIconAssets(async(action,params)=>
 (await rpc('/api/invoke',{action,params})).result);
function focus(win){manager.show(win);}
function icon(view){return iconAssets.make(view);}
async function openApp(view){
 if(windows.has(view.id))return focus(windows.get(view.id));
 const win=el('section',undefined,'window');win.dataset.entry=view.entry;win.style.left=(25+windows.size*24)+'px';win.style.top=(25+windows.size*19)+'px';
 const bar=el('div',undefined,'titlebar'),name=el('strong');name.append(icon(view),el('span',view.title));
 const close=el('button','×');close.setAttribute('aria-label','Закрыть');
 close.onclick=()=>{graphListeners.delete(view.id);manager.remove(win);win.remove();windows.delete(view.id);paintTasks();};
 bar.append(name,close);const content=el('div',undefined,'app-content');win.append(bar,content);desktop.append(win);
 windows.set(view.id,win);manager.add(win,bar,{id:view.id,title:view.title});paintTasks();
 try{
  const app=await import(view.entry);
  await app.mount(content,{
   call:async(action,params={})=>{
    if(!graph.nodes.some(n=>n.type==='action'&&n.id===action))throw Error('Функция не представлена в API-графе');
    return (await rpc('/api/invoke',{action,params})).result;
   },
   graph:()=>structuredClone(graph),
   onGraphChange:callback=>{graphListeners.set(view.id,callback);
    return ()=>graphListeners.delete(view.id);}
  });
 }catch(e){content.replaceChildren(el('p',e.message,'error'));}
}
function paintTasks(){
 tasks.replaceChildren();
 for(const item of manager.list()){
  const b=el('button',item.title);
  b.title=item.id;
  if(item.minimized)b.className='minimized';
  b.onclick=()=>manager.show(item.win);tasks.append(b);
 }
}
async function refresh(){
 try{
  const before=JSON.stringify(graph);
  graph=await rpc('/api/graph');await iconAssets.sync(graph);
  const views=graph.nodes.filter(n=>n.type==='view');
  const ids=new Set(views.map(v=>v.id));
  const reload=[];
  for(const [id,win] of windows){
   const now=views.find(v=>v.id===id);
   if(!ids.has(id)||now?.entry!==win.dataset.entry){
    graphListeners.delete(id);manager.remove(win);win.remove();windows.delete(id);
    if(now)reload.push(now);
   }
  }
  for(const view of reload)await openApp(view);
  if(JSON.stringify(graph)!==before)for(const listener of graphListeners.values()){
   Promise.resolve().then(()=>listener(structuredClone(graph))).catch(()=>{});
  }
  launcher.replaceChildren();
  if(!standalone)drawNavigation(launcher,await rpc('/api/navigation'),graph,openApp,icon);
  if(standalone){document.body.classList.add('standalone');const v=views.find(v=>v.id===standalone);if(v)await openApp(v);else status.textContent='Приложение недоступно';}
  if(!standalone)status.textContent=views.length+' приложений · '+graph.nodes.length+' API';
  paintTasks();
 }catch(e){status.textContent='Ошибка: '+e.message;}
}
document.querySelector('#refresh').onclick=refresh;
if(!token)status.textContent='Требуется токен запуска';else await refresh();
setInterval(refresh,12000);

const builtins=systemViews(desktop,rpc,()=>graph,manager);document.querySelector('#backend-graph').onclick=builtins.graph;document.querySelector('#code-map').onclick=builtins.codemap;

document.querySelector('#mesh-status').onclick=builtins.mesh;

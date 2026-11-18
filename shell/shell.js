import {systemViews} from '/shell/builtin.js';
import {drawNavigation} from '/shell/navigation.js';
import {bindWorkspace} from '/shell/workspace.js';
import {createWindowManager} from '/shell/window_manager.js';
const launcher=document.querySelector('#launcher'),desktop=document.querySelector('#desktop');
const status=document.querySelector('#status'),tasks=document.querySelector('#tasks');
const standalone=new URLSearchParams(location.search).get('app');
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('token')){
 sessionStorage.setItem('ada-token',fragment.get('token'));
 history.replaceState(null,'',location.pathname+location.search);
}
const token=sessionStorage.getItem('ada-token')||'';
let graph={nodes:[],edges:[]};
const manager=createWindowManager(desktop,tasks),windows=new Map();
const builtins=systemViews(desktop,rpc,()=>graph,manager);
const el=(tag,text,cls)=>{
 const x=document.createElement(tag);
 if(text!==undefined)x.textContent=text;
 if(cls)x.className=cls;
 return x;
};
async function rpc(url,data){
 const response=await fetch(url,{
  method:data?'POST':'GET',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:data?JSON.stringify(data):undefined
 });
 const result=await response.json();
 if(!response.ok||result.error)throw Error(result.error||'HTTP '+response.status);
 return result;
}
function icon(view){
 const img=document.createElement('img');
 img.src=view.iconUrl||'/icons/'+encodeURIComponent(view.icon||'workbench')+'.svg';
 img.alt='';return img;
}
async function openApp(request){
 const view=graph.nodes.find(n=>n.type==='view'&&n.id===request?.id&&n.entry===request?.entry);
 if(!view)return;
 if(windows.has(view.id))return windows.get(view.id).handle.focus();
 const win=el('section',undefined,'window');
 win.dataset.entry=view.entry;
 win.style.left=(25+windows.size*24)+'px';
 win.style.top=(25+windows.size*19)+'px';
 const bar=el('div',undefined,'titlebar'),name=el('strong');
 name.append(icon(view),el('span',view.title));
 const content=el('div',undefined,'app-content');
 bar.append(name);win.append(bar,content);desktop.append(win);
 const handle=manager.register(win,bar,{
  key:'app:'+view.id,title:view.title,onClose:()=>windows.delete(view.id)
 });
 windows.set(view.id,{handle,entry:view.entry});
 try{
  const app=await import(view.entry);
  if(!windows.has(view.id))return;
  await app.mount(content,{
   call:async(action,params={})=>{
    if(!graph.nodes.some(n=>n.type==='action'&&n.id===action))
     throw Error('Функция не представлена в API-графе');
    return (await rpc('/api/invoke',{action,params})).result;
   },
   graph:()=>structuredClone(graph)
  });
 }catch(e){if(windows.has(view.id))content.replaceChildren(el('p',e.message,'error'));}
}
async function refresh(){
 try{
  graph=await rpc('/api/graph');
  const views=graph.nodes.filter(n=>n.type==='view');
  status.textContent=views.length+' приложений · '+graph.nodes.length+' API';
  const current=new Map(views.map(v=>[v.id,v])),reload=[];
  for(const [id,entry] of windows){
   const view=current.get(id);
   if(!view||view.entry!==entry.entry){
    entry.handle.close();if(view)reload.push(view);
   }
  }
  for(const view of reload)await openApp(view);
  launcher.replaceChildren();
  if(!standalone){
   const tree=await rpc('/api/navigation');
   const mounted=await bindWorkspace(views,tree,{
    desktop,taskbar:document.querySelector('footer'),
    openApp,icon,system:builtins,status,windows:manager
   });
   if(!mounted)drawNavigation(launcher,tree,graph,openApp);
  }else{
   document.body.classList.add('standalone');
   const view=current.get(standalone);
   if(view)await openApp(view);else status.textContent='Приложение недоступно';
  }
 }catch(e){status.textContent='Ошибка: '+e.message;}
}
document.querySelector('#refresh').onclick=refresh;
document.querySelector('#backend-graph').onclick=builtins.graph;
document.querySelector('#code-map').onclick=builtins.codemap;
document.querySelector('#mesh-status').onclick=builtins.mesh;
if(!token)status.textContent='Требуется токен запуска';
else await refresh();
setInterval(refresh,12000);

import {showGraphs} from '/shell/system_graph.js';
import {showCodeMap} from '/shell/system_codemap.js';
import {showMesh} from '/shell/system_mesh.js';
export function systemViews(desktop,rpc,backend,manager){
 const opened=new Map();
 function open(key,title,render){
  if(opened.has(key))return opened.get(key).focus();
  const win=document.createElement('section');win.className='window system-window';
  win.style.top=(32+opened.size*27)+'px';
  win.style.left=(40+opened.size*36)+'px';
  const bar=document.createElement('div');bar.className='titlebar';
  const name=document.createElement('strong');name.textContent=title;bar.append(name);
  const body=document.createElement('div');body.className='app-content';
  win.append(bar,body);desktop.append(win);
  const handle=manager.register(win,bar,{
   key:'system:'+key,title,onClose:()=>opened.delete(key)
  });
  opened.set(key,handle);
  Promise.resolve().then(()=>render(body)).catch(e=>{
   body.textContent=e.message;body.classList.add('error');
  });
 }
 return {
  graph:()=>open('graphs','API Graph · Frontend / Backend',host=>showGraphs(host,rpc)),
  codemap:()=>open('codemap','CodeMap · L0 / L1 / L2',host=>showCodeMap(host,rpc)),
  mesh:()=>open('mesh','Continuity Mesh',host=>showMesh(host,rpc))
 };
}

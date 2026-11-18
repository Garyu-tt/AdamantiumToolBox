import {showGraphs} from '/shell/system_graph.js';
import {showCodeMap} from '/shell/system_codemap.js';
import {showMesh} from '/shell/system_mesh.js';
const windows=new Map();
export function systemViews(desktop,rpc,backend,manager){
 function open(key,title,render){
  let win=windows.get(key);
  if(win){manager.show(win);return;}
  win=document.createElement('section');win.className='window system-window';
  win.style.top=(32+windows.size*27)+'px';win.style.left=(40+windows.size*36)+'px';
  const bar=document.createElement('div');bar.className='titlebar';
  const name=document.createElement('strong');name.textContent=title;
  const close=document.createElement('button');close.textContent='×';close.ariaLabel='Закрыть';
  close.onclick=()=>{manager.remove(win);win.remove();windows.delete(key);};
  bar.append(name,close);
  const body=document.createElement('div');body.className='app-content';
  win.append(bar,body);desktop.append(win);windows.set(key,win);
  manager.add(win,bar,{id:'system:'+key,title});
  render(body).catch(e=>{body.textContent=e.message;body.classList.add('error');});
 }
 return {
  graph:()=>open('graphs','API Graph · Frontend / Backend',host=>showGraphs(host,rpc)),
  codemap:()=>open('codemap','CodeMap · L0 / L1 / L2',host=>showCodeMap(host,rpc)),
  mesh:()=>open('mesh','Continuity Mesh',host=>showMesh(host,rpc))
 };
}

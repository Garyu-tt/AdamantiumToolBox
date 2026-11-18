import {showGraphs} from '/shell/system_graph.js';
import {showCodeMap} from '/shell/system_codemap.js';
import {showMesh} from '/shell/system_mesh.js';
const windows=new Map();let z=100;
export function systemViews(desktop,rpc,backend){
 function open(key,title,render){
  let win=windows.get(key);
  if(win){win.style.zIndex=++z;return;}
  win=document.createElement('section');win.className='window system-window';
  win.style.top=(32+windows.size*27)+'px';win.style.left=(40+windows.size*36)+'px';
  const bar=document.createElement('div');bar.className='titlebar';
  const name=document.createElement('strong');name.textContent=title;
  const close=document.createElement('button');close.textContent='×';close.ariaLabel='Закрыть';
  close.onclick=()=>{win.remove();windows.delete(key);};
  bar.append(name,close);
  const body=document.createElement('div');body.className='app-content';
  win.append(bar,body);desktop.append(win);win.style.zIndex=++z;windows.set(key,win);
  let dx=0,dy=0;
  bar.addEventListener('pointerdown',e=>{
   if(e.target===close)return;
   dx=e.clientX-win.offsetLeft;dy=e.clientY-win.offsetTop;
   bar.setPointerCapture(e.pointerId);win.style.zIndex=++z;
  });
  bar.addEventListener('pointermove',e=>{
   if(!bar.hasPointerCapture(e.pointerId))return;
   win.style.left=Math.max(0,e.clientX-dx)+'px';win.style.top=Math.max(0,e.clientY-dy)+'px';
  });
  render(body).catch(e=>{body.textContent=e.message;body.classList.add('error');});
 }
 return {
  graph:()=>open('graphs','API Graph · Frontend / Backend',host=>showGraphs(host,rpc)),
  codemap:()=>open('codemap','CodeMap · L0 / L1 / L2',host=>showCodeMap(host,rpc)),
  mesh:()=>open('mesh','Continuity Mesh',host=>showMesh(host,rpc))
 };
}

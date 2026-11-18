import {controls,bound,backendActions} from './model.js';
const el=(tag,label,cls)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;if(cls)n.className=cls;return n;};
export function renderCanvas(host,doc,tab,api,mode,onSelect,onMove){
 host.replaceChildren();
 host.className='studio-canvas';
 const actions=new Set(backendActions(api).map(n=>n.id));
 for(const node of controls(doc,tab)){
  const binding=bound(doc,node.id);
  if(mode==='preview'&&(node.kind==='button'||node.kind==='connector')&&!actions.has(binding))continue;
  const b=el(node.kind==='label'?'div':'button',node.title,'studio-piece '+node.kind);
  b.dataset.id=node.id;b.style.left=node.x+'px';b.style.top=node.y+'px';
  b.title=binding||node.id;host.append(b);
  if(mode==='edit'){
   b.onpointerdown=ev=>{
    if(ev.button!==0)return;
    ev.preventDefault();onSelect(node.id);
    const rect=host.getBoundingClientRect(),dx=ev.clientX-rect.left-node.x,dy=ev.clientY-rect.top-node.y;
    b.setPointerCapture(ev.pointerId);let dragged=false;
    b.onpointermove=e=>{
     dragged=true;node.x=Math.max(0,Math.min(2500,Math.round(e.clientX-rect.left-dx)));
     node.y=Math.max(0,Math.min(2500,Math.round(e.clientY-rect.top-dy)));
     b.style.left=node.x+'px';b.style.top=node.y+'px';
    };
    b.onpointerup=()=>{
     b.onpointermove=null;b.onpointerup=null;
     if(dragged)onMove(node.id);
    };
   };
  }else if(binding){
   b.onclick=async()=>{
    try{const result=await api.call(binding,{});onSelect({title:node.title,result});}
    catch(e){onSelect({title:node.title,error:e.message});}
   };
  }
 }
}

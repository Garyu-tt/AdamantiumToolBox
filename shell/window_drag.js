import {edgeZone} from './window_geometry.js';
/** Drag stays anchored to the pointer; pointer capture works for mouse and touch. */
export function attachWindowDrag(desktop,win,bar,actions){
 bar.style.touchAction='none';
 const preview=document.createElement('div');preview.className='win-snap-preview';
 desktop.append(preview);
 let drag=null;
 function indicate(zone){
  const rect=zone?actions.rectangle(zone):null;
  preview.classList.toggle('visible',!!rect);
  if(rect)Object.assign(preview.style,{
   left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'
  });
 }
 bar.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button')||event.target.closest('input'))return;
  actions.focus();
  const area=desktop.getBoundingClientRect(),before=win.getBoundingClientRect();
  if(actions.isDocked()){
   const fraction=(event.clientX-before.left)/Math.max(before.width,1);
   actions.restore();
   const updated=win.getBoundingClientRect();
   win.style.left=Math.max(0,event.clientX-area.left-fraction*updated.width)+'px';
   win.style.top=Math.max(0,event.clientY-area.top-14)+'px';
  }
  const bounds=win.getBoundingClientRect();
  drag={id:event.pointerId,dx:event.clientX-bounds.left,dy:event.clientY-bounds.top,zone:null};
  bar.setPointerCapture(event.pointerId);
 });
 bar.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const area=desktop.getBoundingClientRect();
  const x=event.clientX-area.left,y=event.clientY-area.top;
  win.style.left=Math.max(0,x-drag.dx)+'px';
  win.style.top=Math.max(0,y-drag.dy)+'px';
  drag.zone=edgeZone(x,y,area.width,area.height);
  indicate(drag.zone);
 });
 function stop(event){
  if(!drag||event.pointerId!==drag.id)return;
  const zone=drag.zone;drag=null;indicate(null);
  if(bar.hasPointerCapture(event.pointerId))bar.releasePointerCapture(event.pointerId);
  if(event.type==='pointerup'&&zone)actions.snap(zone);
 }
 bar.addEventListener('pointerup',stop);
 bar.addEventListener('pointercancel',stop);
 return ()=>{preview.remove();};
}

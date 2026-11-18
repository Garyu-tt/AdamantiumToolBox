import {edgeZone} from './window_geometry.js';
/** Pointer capture keeps the titlebar under the cursor on mouse and touch. */
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
  if(event.button!==0||event.target.closest('button,input'))return;
  actions.focus();
  const bounds=win.getBoundingClientRect();
  drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,
   dx:event.clientX-bounds.left,dy:event.clientY-bounds.top,
   fraction:(event.clientX-bounds.left)/Math.max(bounds.width,1),
   docked:actions.isDocked(),moving:false,zone:null};
  bar.setPointerCapture(event.pointerId);
 });
 bar.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(!drag.moving&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
  const area=desktop.getBoundingClientRect();
  const x=event.clientX-area.left,y=event.clientY-area.top;
  if(!drag.moving){
   drag.moving=true;
   if(drag.docked){
    actions.restore();
    const updated=win.getBoundingClientRect();
    drag.dx=drag.fraction*updated.width;drag.dy=14;
   }
  }
  const minLeft=Math.min(0,48-win.offsetWidth),maxLeft=Math.max(0,area.width-48);
  win.style.left=Math.min(maxLeft,Math.max(minLeft,x-drag.dx))+'px';
  win.style.top=Math.min(Math.max(0,area.height-26),Math.max(0,y-drag.dy))+'px';
  drag.zone=edgeZone(x,y,area.width,area.height);
  indicate(drag.zone);
 });
 function stop(event){
  if(!drag||event.pointerId!==drag.id)return;
  const {moving,zone}=drag;drag=null;indicate(null);
  if(bar.hasPointerCapture(event.pointerId))bar.releasePointerCapture(event.pointerId);
  if(event.type==='pointerup'&&moving&&zone)actions.snap(zone);
 }
 bar.addEventListener('pointerup',stop);
 bar.addEventListener('pointercancel',stop);
 return ()=>preview.remove();
}

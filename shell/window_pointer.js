import {dragPosition,snapTarget} from './window_geometry.js';
export function enableWindowDrag(win,bar,desktop,config,{focus,detach,snap,toggleMax,preview}){
 let current=null;
 const finish=(e,snapOnRelease)=>{
  if(!current||e.pointerId!==current.pointerId)return;
  const state=current;current=null;preview(null);
  bar.removeEventListener('pointermove',move);
  bar.removeEventListener('pointerup',end);
  bar.removeEventListener('pointercancel',cancel);
  bar.removeEventListener('lostpointercapture',lost);
  if(bar.hasPointerCapture(e.pointerId))bar.releasePointerCapture(e.pointerId);
  if(state.moving&&snapOnRelease){
   const rect=desktop.getBoundingClientRect();
   const target=snapTarget({x:e.clientX,y:e.clientY},rect,config.snapThresholdPx);
   if(target)snap(win,target,state.origin);
  }
 };
 const end=e=>finish(e,true),cancel=e=>finish(e,false);
 const lost=e=>finish(e,false);
 const move=e=>{
  if(!current||e.pointerId!==current.pointerId)return;
  if(!current.moving){
   if(Math.hypot(e.clientX-current.x,e.clientY-current.y)<4)return;
   detach(win,current.x,current.y);
   current.moving=true;
   current.origin={x:current.x,y:current.y,left:win.offsetLeft,top:win.offsetTop,
    width:win.offsetWidth,height:win.offsetHeight};
  }
  const area={width:desktop.clientWidth,height:desktop.clientHeight};
  const pos=dragPosition(current.origin,{x:e.clientX,y:e.clientY},area);
  win.style.left=pos.left+'px';win.style.top=pos.top+'px';
  preview(snapTarget({x:e.clientX,y:e.clientY},desktop.getBoundingClientRect(),
   config.snapThresholdPx));
 };
 bar.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button,input,textarea,select,a'))return;
  if(current)return;
  e.preventDefault();focus(win);
  current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,moving:false};
  bar.setPointerCapture(e.pointerId);
  bar.addEventListener('pointermove',move);
  bar.addEventListener('pointerup',end);
  bar.addEventListener('pointercancel',cancel);
  bar.addEventListener('lostpointercapture',lost);
 });
 bar.addEventListener('dblclick',e=>{
  if(!e.target.closest('button,input,textarea,select,a'))toggleMax(win);
 });
}

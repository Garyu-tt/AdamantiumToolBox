import {positionsFor,swapInto} from './icon_grid.js';
/** Icons are only presentation: the caller validates graph-backed actions. */
export function renderIcons(canvas,items,state,{icon,open,menu,save,moved}){
 canvas.replaceChildren();
 const area={width:canvas.clientWidth||canvas.parentElement.clientWidth,
  height:canvas.clientHeight||canvas.parentElement.clientHeight};
 const coords=positionsFor(items,state.positions,area.width,area.height);
 for(const item of items){
  const button=document.createElement('button');button.type='button';
  button.className='ada-shortcut';button.title=item.name;
  button.dataset.id=item.id;button.dataset.kind=item.type;
  const picture=item.type==='folder'?document.createElement('span'):icon(item);
  if(item.type==='folder'){picture.className='ada-folder-icon';picture.textContent='📁';}
  const label=document.createElement('span');label.className='ada-shortcut-label';label.textContent=item.name;
  button.append(picture,label);
  button.style.left=coords[item.id].x+'px';button.style.top=coords[item.id].y+'px';
  button.onclick=()=>{if(button.dataset.dragged){delete button.dataset.dragged;return;}open(item);};
  button.oncontextmenu=e=>{e.preventDefault();menu(e,item);};
  let active=null;
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   active={id:e.pointerId,sx:e.clientX,sy:e.clientY,from:coords[item.id],drag:false};
   button.setPointerCapture(e.pointerId);
  });
  button.addEventListener('pointermove',e=>{
   if(!active||e.pointerId!==active.id)return;
   if(!active.drag&&Math.hypot(e.clientX-active.sx,e.clientY-active.sy)<7)return;
   active.drag=true;button.classList.add('is-dragging');
   button.style.left=Math.max(0,active.from.x+e.clientX-active.sx)+'px';
   button.style.top=Math.max(0,active.from.y+e.clientY-active.sy)+'px';
  });
  function finish(e){
   if(!active||active.id!==e.pointerId)return;
   const drag=active;active=null;button.classList.remove('is-dragging');
   if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);
   if(!drag.drag)return;
   button.dataset.dragged='1';
   button.style.pointerEvents='none';
   const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.ada-shortcut');
   button.style.pointerEvents='';
   const destination=target&&target!==button?items.find(x=>x.id===target.dataset.id):null;
   if(e.type==='pointerup'&&destination?.type==='folder'&&destination.id.startsWith('user:')){
    if(moved(item,destination))save();
   }else if(e.type==='pointerup'){
    if(swapInto(state,item.id,{x:drag.from.x+e.clientX-drag.sx,
     y:drag.from.y+e.clientY-drag.sy},coords,area.width,area.height))save();
   }
   canvas.dispatchEvent(new CustomEvent('ada-icons-changed'));
  }
  button.addEventListener('pointerup',finish);
  button.addEventListener('pointercancel',finish);
  canvas.append(button);
 }
 return coords;
}

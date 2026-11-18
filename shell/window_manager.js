import {layoutRects,snapRect,fitFloating} from './window_geometry.js';
import {attachWindowDrag} from './window_drag.js';
export function createWindowManager(desktop,tasks){
 const records=new Map();let selected=null,z=100;
 const bounds=()=>({width:desktop.clientWidth,height:desktop.clientHeight});
 function geometry(win){
  const area=desktop.getBoundingClientRect(),rect=win.getBoundingClientRect();
  return {x:rect.left-area.left,y:rect.top-area.top,width:rect.width,height:rect.height};
 }
 function position(record,rect){
  const {win}=record;
  Object.assign(win.style,{left:rect.x+'px',top:rect.y+'px',
   width:rect.width+'px',height:rect.height+'px'});
 }
 function repaint(){
  tasks.replaceChildren();
  for(const item of records.values()){
   const b=document.createElement('button');b.type='button';
   b.textContent=item.title;b.className='win-task';
   b.classList.toggle('active',item===selected&&!item.win.hidden);
   b.setAttribute('aria-pressed',String(item===selected&&!item.win.hidden));
   b.onclick=()=>item===selected&&!item.win.hidden?minimize(item):focus(item);
   tasks.append(b);
  }
 }
 function focus(item){
  if(!records.has(item.key))return;
  item.win.hidden=false;item.win.style.zIndex=String(++z);
  selected=item;for(const r of records.values())r.win.classList.toggle('is-focused',r===item);
  repaint();
 }
 function restore(item){
  item.win.hidden=false;
  if(item.mode){
   item.mode=null;delete item.win.dataset.mode;
   if(item.normal){const {width,height}=bounds();position(item,fitFloating(item.normal,width,height));}
  }
  focus(item);
 }
 function minimize(item){
  item.win.hidden=true;
  if(selected===item)selected=null;
  item.win.classList.remove('is-focused');repaint();
 }
 function rectangle(zone){
  const {width,height}=bounds();return snapRect(width,height,zone);
 }
 function dock(item,zone){
  if(!item.mode)item.normal=geometry(item.win);
  item.mode={kind:'snap',zone};item.win.dataset.mode=zone;
  position(item,rectangle(zone));focus(item);
 }
 function maximize(item){item.mode?.zone==='max'?restore(item):dock(item,'max');}
 function close(item){
  if(!records.has(item.key))return;
  records.delete(item.key);item.cleanup?.();item.win.remove();
  item.onClose?.();
  if(selected===item)selected=null;
  repaint();
 }
 function register(win,bar,{key,title,onClose}){
  if(records.has(key))throw Error('duplicate_window_key');
  const item={key,title,onClose,win,bar,mode:null,normal:null,cleanup:null};
  records.set(key,item);
  const controls=document.createElement('span');controls.className='win-controls';
  for(const [text,label,action] of [
   ['−','Свернуть',()=>minimize(item)],['□','Развернуть или восстановить',()=>maximize(item)],
   ['×','Закрыть',()=>close(item)]]){
   const b=document.createElement('button');b.type='button';b.textContent=text;
   b.setAttribute('aria-label',label);b.title=label;b.onclick=action;controls.append(b);
  }
  bar.append(controls);
  bar.addEventListener('dblclick',e=>{if(!e.target.closest('button'))maximize(item);});
  win.addEventListener('pointerdown',()=>focus(item));
  item.cleanup=attachWindowDrag(desktop,win,bar,{focus:()=>focus(item),
   isDocked:()=>!!item.mode,restore:()=>restore(item),
   snap:zone=>dock(item,zone),rectangle});
  const handle={focus:()=>focus(item),close:()=>close(item),minimize:()=>minimize(item),restore:()=>restore(item),
   maximize:()=>maximize(item),snap:zone=>dock(item,zone),element:win};
  focus(item);return handle;
 }
 function arrange(preset){
  const count=preset==='focus'?3:preset,shown=[...records.values()].filter(item=>!item.win.hidden).slice(0,count);
  if(!shown.length)return 0;
  const {width,height}=bounds(),rects=layoutRects(width,height,preset,shown.length);
  for(let i=0;i<shown.length;i++){
   const item=shown[i];if(!item.mode)item.normal=geometry(item.win);
   item.mode={kind:'tile',preset,slot:i};item.win.dataset.mode='tile';
   position(item,rects[i]);
  }
  focus(shown[0]);return shown.length;
 }
 function reflow(){
  const {width,height}=bounds();if(!width||!height)return;
  for(const item of records.values()){
   if(item.mode?.kind==='snap')position(item,snapRect(width,height,item.mode.zone));
   if(item.mode?.kind==='tile'){
    const {preset,slot}=item.mode;
    position(item,layoutRects(width,height,preset)[slot]);
   }
  }
 }
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(reflow):null;
 observer?.observe(desktop);if(!observer)window.addEventListener('resize',reflow);
 document.addEventListener('keydown',event=>{
  if(event.target.closest?.('input,textarea,select,[contenteditable]'))return;
  const arrow=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key);
  if(selected&&arrow&&(event.metaKey||(event.ctrlKey&&event.altKey))){
   event.preventDefault();
   if(event.key==='ArrowLeft')dock(selected,'left');
   if(event.key==='ArrowRight')dock(selected,'right');
   if(event.key==='ArrowUp')dock(selected,'max');
   if(event.key==='ArrowDown')selected.mode?restore(selected):minimize(selected);
  }
  if(event.ctrlKey&&event.altKey&&['Digit2','Digit3','Digit4','Digit8'].includes(event.code)){
   event.preventDefault();arrange(event.code==='Digit3'?'focus':Number(event.code.slice(-1)));
  }
 });
 return {register,arrange,reflow,windows:()=>[...records.keys()]};
}

import {tileBounds,snapBounds,restoreBounds} from './window_geometry.js';
import {enableWindowDrag} from './window_pointer.js';
import {createSnapPreview} from './window_preview.js';
export function createWindowManager(desktop,config,onChange=()=>{}){
 if(config.schema!=='mas-window-layouts-1'||!Array.isArray(config.layouts))throw Error('window_layout_config_invalid');
 const entries=new Map();let z=100,active=null,layout=null,ratio=config.ratio.default;
 const size=()=>({width:desktop.clientWidth,height:desktop.clientHeight});
 const preview=createSnapPreview(desktop,size,()=>config.snapRatio);
 const bounds=win=>({left:win.offsetLeft,top:win.offsetTop,width:win.offsetWidth,height:win.offsetHeight});
 const paint=(win,box,mode)=>{
  for(const key of ['left','top','width','height'])win.style[key]=Math.round(box[key])+'px';
  win.classList.toggle('tiled',mode!=='free');
  entries.get(win).mode=mode;
 };
 const focus=win=>{
  if(!entries.has(win))return;active=win;win.style.zIndex=++z;onChange();
 };
 const visible=()=>[...entries.keys()].filter(win=>!entries.get(win).minimized);
 function arrange(){
  if(!layout)return;
  const targets=visible().filter(win=>entries.get(win).mode==='tile');
  const boxes=tileBounds(targets.length,layout,size(),ratio,config);
  targets.forEach((win,i)=>paint(win,boxes[i],'tile'));
 }
 function restore(win){
  const state=entries.get(win);if(!state)return;state.minimized=false;win.style.display='';
  paint(win,restoreBounds(state.saved,size()),'free');
  if(layout)arrange();focus(win);
 }
 function snap(win,target,origin){
  const state=entries.get(win);if(!state)return;
  if(state.mode==='free')state.saved=origin||bounds(win);
  state.minimized=false;win.style.display='';
  const mode=target==='maximize'?'max':target;
  paint(win,snapBounds(target,size().width,size().height,config.snapRatio),mode);
  if(layout)arrange();focus(win);
 }
 const toggleMax=win=>entries.get(win)?.mode==='max'?restore(win):snap(win,'maximize');
 function detach(win,clientX,clientY){
  const state=entries.get(win);if(state?.mode==='free')return;
  const old=win.getBoundingClientRect(),box=restoreBounds(state.saved,size());
  const anchor=Math.min(1,Math.max(0,(clientX-old.left)/Math.max(old.width,1)));
  const titleOffset=Math.min(25,Math.max(0,clientY-old.top));
  const area=desktop.getBoundingClientRect();
  box.left=Math.min(Math.max(0,clientX-area.left-box.width*anchor),Math.max(0,size().width-box.width));
  box.top=Math.min(Math.max(0,clientY-area.top-titleOffset),Math.max(0,size().height-box.height));
  paint(win,box,'free');if(layout)arrange();
 }
 function add(win,bar,{id,title}){
  if(entries.has(win))throw Error('window_already_registered');
  entries.set(win,{id,title,mode:'free',saved:bounds(win),minimized:false});
  const close=bar.querySelector('button[aria-label="Закрыть"]');
  const control=(symbol,description,handler)=>{
   const button=document.createElement('button');button.textContent=symbol;
   button.setAttribute('aria-label',description);button.title=description;
   button.onclick=()=>handler(win);bar.insertBefore(button,close);return button;
  };
  control('−','Свернуть',minimize);
  control('□','Развернуть или восстановить',toggleMax);
  enableWindowDrag(win,bar,desktop,config,{focus,detach,snap,toggleMax,preview});
  win.addEventListener('pointerdown',()=>focus(win));
  if(layout){entries.get(win).mode='tile';arrange();}
  focus(win);
 }
 function remove(win){
  entries.delete(win);if(active===win)active=visible().at(-1)||null;
  if(layout)arrange();onChange();
 }
 function minimize(win){
  const state=entries.get(win);if(!state)return;
  state.minimized=true;win.style.display='none';
  if(active===win)active=visible().at(-1)||null;
  if(layout)arrange();onChange();
 }
 function show(win){
  const state=entries.get(win);if(!state)return;
  if(state.minimized){state.minimized=false;win.style.display='';
   if(layout)arrange();}
  focus(win);
 }
 function tile(mode,split=ratio){
  if(!config.layouts.some(x=>x.id===mode))throw Error('layout_unknown');
  const selected=visible();
  if(selected.length>config.maxTiled)throw Error('too_many_windows_for_grid');
  ratio=Math.min(config.ratio.max,Math.max(config.ratio.min,split));
  layout=mode;for(const win of selected){
   const state=entries.get(win);
   if(state.mode==='free')state.saved=bounds(win);
   state.mode='tile';
  }
  arrange();onChange();return selected.length;
 }
 function restoreAll(){
  layout=null;
  for(const [win,state] of entries){state.mode='free';
   paint(win,restoreBounds(state.saved,size()),'free');}
  onChange();
 }
 function reflow(){
  const area=size();
  for(const [win,state] of entries){
   if(state.minimized)continue;
   if(state.mode==='max')paint(win,snapBounds('maximize',area.width,area.height,config.snapRatio),'max');
   else if(state.mode!=='free'&&state.mode!=='tile')
    paint(win,snapBounds(state.mode,area.width,area.height,config.snapRatio),state.mode);
   else if(state.mode==='free')paint(win,restoreBounds(bounds(win),area),'free');
  }
  arrange();
 }
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(reflow).observe(desktop);
 document.addEventListener('keydown',e=>{
  if(!active||!e.ctrlKey||!e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return;
  const choice={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'maximize'};
  if(e.key==='ArrowDown'){e.preventDefault();restore(active);}
  else if(choice[e.key]){e.preventDefault();snap(active,choice[e.key]);}
 });
 return {add,remove,show,focus,minimize,restore,snap,tile,toggleMax,
  restoreAll,list:()=>[...entries].map(([win,s])=>({win,id:s.id,title:s.title,minimized:s.minimized})),
  settings:()=>({layout,ratio,config})};
}

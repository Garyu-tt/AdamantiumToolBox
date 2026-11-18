import {visibleTree,availableViews,flatten,findItem} from './model.js';
import {folderWindow} from './explorer.js';
import {mountLayouts} from './layouts.js';
const el=(tag,cls='',text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const pinKey='mas.desktop.pins.v1';
export async function mount(host,api){
 if(!api.shell){host.append(el('p','','Desktop Workspace запускается как оболочка Toolbox.'));return;}
 const shell=api.shell,style=el('link');style.rel='stylesheet';style.href=new URL('./style.css',import.meta.url).href;
 document.head.append(style);
 const canvas=el('div','ada-canvas'),start=el('section','ada-start'),list=el('div','ada-start-list');
 const search=el('input','ada-search');search.type='search';search.placeholder='Поиск приложений и папок';
 const startButton=el('button','ada-start-button','⊞ Пуск'),tray=el('div','ada-tray');
 const clock=el('time','ada-clock'),state=el('span','ada-tray-status');
 const context=el('div','ada-context');
 start.append(search,list);tray.append(state,clock);
 host.prepend(canvas);document.body.append(start,context);
 shell.taskbar.prepend(startButton);shell.taskbar.append(tray);
 const layouts=mountLayouts(shell.taskbar,shell.windows);
 let tree=[],views=new Map(),pins=[],opened=new Set();
 try{const saved=JSON.parse(localStorage.getItem(pinKey)||'[]');if(Array.isArray(saved))pins=saved.filter(x=>typeof x==='string');}catch{}
 const save=()=>{try{localStorage.setItem(pinKey,JSON.stringify(pins));}catch{}};
 const toggleStart=show=>{start.classList.toggle('open',show);startButton.setAttribute('aria-expanded',String(show));if(show){search.value='';paintStart();search.focus();}};
 function open(item){
  toggleStart(false);context.replaceChildren();context.classList.remove('open');
  if(item.type==='folder'){
   const w=folderWindow(host,item,view=>view&&shell.openApp(view),shell.icon,views,shell.windows);
   opened.add(w);return;
  }
  const view=views.get(item.view);if(view)shell.openApp(view);
 }
 function popup(event,item){
  if(item.type!=='app')return;
  event.preventDefault();
  const button=el('button','',pins.includes(item.view)?'Открепить от рабочего стола':'Закрепить на рабочем столе');
  button.onclick=()=>{
   pins=pins.includes(item.view)?pins.filter(v=>v!==item.view):[...pins,item.view];
   save();paintDesktop();paintStart();context.classList.remove('open');
  };
  context.replaceChildren(button);context.style.left=Math.min(event.clientX,innerWidth-240)+'px';
  context.style.top=Math.min(event.clientY,innerHeight-55)+'px';context.classList.add('open');
 }
 function shortcut(item,cls='ada-shortcut'){
  const b=el('button',cls);b.type='button';b.title=item.name;
  const image=item.type==='folder'?el('span','ada-folder-icon','📁'):shell.icon(views.get(item.view)||{});
  b.append(image,el('span','ada-shortcut-label',item.name));
  b.onclick=()=>open(item);b.oncontextmenu=e=>popup(e,item);return b;
 }
 function paintDesktop(){
  canvas.replaceChildren();
  const existing=new Set();
  for(const item of tree){
   canvas.append(shortcut(item));if(item.type==='app')existing.add(item.view);
  }
  for(const id of pins){
   const item=findItem(tree,id),view=views.get(id);
   if(!existing.has(id)&&view)canvas.append(shortcut(item||{type:'app',name:view.title,view:id}));
  }
 }
 function paintStart(){
  list.replaceChildren();
  const q=search.value.trim().toLocaleLowerCase();
  const items=q?flatten(tree).filter(x=>x.path.toLocaleLowerCase().includes(q)):tree;
  const build=(items,container,depth=0)=>{
   for(const item of items){
    if(item.type==='folder'&&!q){
     const folder=el('details','ada-start-folder'),head=el('summary','',item.name);
     folder.append(head);const inside=el('div','ada-start-children');folder.append(inside);
     build(item.children,inside,depth+1);container.append(folder);
    }else{
     const b=shortcut(item,'ada-start-entry');if(q)b.title=item.path;
     container.append(b);
    }
   }
  };
  build(items,list);
  if(!q){
   const label=el('p','ada-start-caption','Инструменты оболочки');list.append(label);
   const names={graph:'Графы',codemap:'CodeMap',mesh:'Mesh'};
   for(const [key,run] of Object.entries(shell.system||{})){
    const b=el('button','ada-start-entry',names[key]||key);
    b.onclick=()=>{toggleStart(false);run();};list.append(b);
   }
  }
  if(!list.children.length)list.append(el('p','ada-empty','Ничего не найдено'));
 }
 function update(nextTree,nextViews){
  views=availableViews(nextViews);tree=visibleTree(nextTree,nextViews);
  pins=pins.filter(id=>views.has(id));paintDesktop();if(start.classList.contains('open'))paintStart();
  state.textContent=shell.status.textContent;
 }
 function tick(){
  const now=new Date();clock.textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now);
  clock.dateTime=now.toISOString();
 }
 const outside=e=>{
  if(!start.contains(e.target)&&!startButton.contains(e.target))toggleStart(false);
  if(!context.contains(e.target))context.classList.remove('open');
 };
 const keyboard=e=>{
  if(e.ctrlKey&&e.key==='Escape'){
   e.preventDefault();toggleStart(!start.classList.contains('open'));return;
  }
  if(e.key==='Escape'){toggleStart(false);context.classList.remove('open');}
 };

 startButton.onclick=()=>toggleStart(!start.classList.contains('open'));
 search.oninput=paintStart;document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
 const timer=setInterval(tick,30000);tick();update(shell.tree,shell.views);
 return {update,dispose(){
  clearInterval(timer);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);
  for(const w of opened)w.close();layouts.dispose();
  for(const node of [canvas,start,context,startButton,tray,style])node.remove();
 }};
}

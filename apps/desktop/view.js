import {visibleTree,availableViews} from './model.js';
import {empty,decode,folder,pin,move,customItems} from './state.js';
import {contextActions} from './context_actions.js';
import {userFolder,rootLinks} from './user_tree.js';
import {renderIcons} from './canvas.js';
import {paintStart} from './start_menu.js';
import {createMenu} from './menu.js';
import {folderWindow} from './explorer.js';
import {mountLayouts} from './layouts.js';
const el=(tag,cls='',text)=>{
 const node=document.createElement(tag);node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
};
const key='mas.desktop.layout.v1';
export async function mount(host,api){
 if(!api.shell){host.append(el('p','','Рабочий стол доступен в оболочке Toolbox.'));return;}
 const shell=api.shell,style=el('link');style.rel='stylesheet';
 style.href=new URL('./style.css',import.meta.url).href;document.head.append(style);
 const canvas=el('div','ada-canvas'),start=el('section','ada-start');
 const list=el('div','ada-start-list'),search=el('input','ada-search');
 search.type='search';search.placeholder='Найти приложения или папки';
 const startButton=el('button','ada-start-button','⊞ Пуск');
 const tray=el('div','ada-tray'),clock=el('time','ada-clock'),status=el('span','ada-tray-status');
 tray.append(status,clock);start.append(search,list);
 host.prepend(canvas);document.body.append(start);
 shell.taskbar.prepend(startButton);shell.taskbar.append(tray);
 const layouts=mountLayouts(shell.taskbar,shell.windows),menu=createMenu();
 let state=empty(),tree=[],views=new Map(),legacy=null;
 try{state=decode(localStorage.getItem(key));legacy=JSON.parse(localStorage.getItem('mas.desktop.pins.v1')||'[]');}catch{}
 const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch{}};
 const createFolder=parent=>{
  const name=prompt('Название папки','Новая папка');
  if(name!==null)try{folder(state,name,parent);save();redraw();}catch{}
 };
 function toggleStart(on){
  start.classList.toggle('open',on);startButton.setAttribute('aria-expanded',String(on));
  if(on){search.value='';showStart();search.focus();}
 }
 function open(item){
  toggleStart(false);menu.close();
  if(item.type==='folder'){
   const target=item.id?.startsWith('user:')?userFolder(state,item.id,views):item;
   if(target)folderWindow(host,target,v=>v&&shell.openApp(v),shell.icon,views,shell.windows);
  }else{
   const view=views.get(item.view);if(view)shell.openApp(view);
  }
 }
 function context(event,item){
  const actions=contextActions(item,state,{createFolder,changed:()=>{save();redraw();}});
  if(actions.length)menu.show(event,actions);
 }
 const showStart=()=>paintStart(list,search.value,tree,state,views,{
  icon:shell.icon,open,context,system:Object.fromEntries(Object.entries(shell.system||{})
   .map(([name,run])=>[name,()=>{toggleStart(false);run();}])),createFolder
 });
 function redraw(){
  const items=[...rootLinks(tree),...customItems(state,null,views)];
  renderIcons(canvas,items,state,{
   icon:item=>shell.icon(views.get(item.view)||{}),open,menu:context,save,
   moved:(item,target)=>{
    if(item.id.startsWith('user:'))return move(state,item.id,target.id);
    if(item.type==='app'){pin(state,item.view,target.id);return true;}
    return false;
   }
  });
  if(start.classList.contains('open'))showStart();
 }
 function update(nextTree,nextViews){
  views=availableViews(nextViews);tree=visibleTree(nextTree,nextViews);
  if(Array.isArray(legacy)){
   for(const view of legacy)if(views.has(view))pin(state,view);
   legacy=null;save();
  }
  redraw();status.textContent=shell.status.textContent;
 }
 const tick=()=>{
  const now=new Date();clock.textContent=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now);
  clock.dateTime=now.toISOString();
 };
 const outside=e=>{if(!start.contains(e.target)&&!startButton.contains(e.target))toggleStart(false);};
 const keyboard=e=>{
  if(e.ctrlKey&&e.key==='Escape'){e.preventDefault();toggleStart(!start.classList.contains('open'));}
  else if(e.key==='Escape')toggleStart(false);
 };
 canvas.oncontextmenu=e=>{if(e.target===canvas)context(e,null);};
 canvas.addEventListener('ada-icons-changed',redraw);
 startButton.onclick=()=>toggleStart(!start.classList.contains('open'));search.oninput=showStart;
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);
 const observer=new ResizeObserver(redraw);observer.observe(canvas);
 const timer=setInterval(tick,30000);tick();update(shell.tree,shell.views);
 return {update,dispose(){
  clearInterval(timer);observer.disconnect();
  document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);
  layouts.dispose();menu.dispose();
  for(const node of [canvas,start,startButton,tray,style])node.remove();
 }};
}

import {flatten} from './model.js';
import {customItems} from './state.js';
import {userFolder} from './user_tree.js';
/** Start is a projection of live LinkFS and the user's local folder overlay. */
export function paintStart(list,query,tree,state,views,{icon,open,context,system,createFolder}){
 const el=(tag,cls='',text)=>{
  const x=document.createElement(tag);x.className=cls;
  if(text!==undefined)x.textContent=text;return x;
 };
 list.replaceChildren();
 const personal=customItems(state,null,views).map(item=>
  item.type==='folder'?userFolder(state,item.id,views):item);
 const q=query.trim().toLocaleLowerCase(),source=[...tree,...personal];
 const items=q?flatten(source).filter(x=>x.path.toLocaleLowerCase().includes(q)):source;
 const shortcut=item=>{
  const b=el('button','ada-start-entry');b.type='button';b.title=item.name;
  const picture=item.type==='folder'?el('span','ada-folder-icon','📁'):icon(views.get(item.view)||{});
  b.append(picture,el('span','ada-shortcut-label',item.name));
  b.onclick=()=>open(item);b.oncontextmenu=e=>context(e,item);return b;
 };
 function draw(nodes,parent){
  for(const item of nodes){
   if(item.type==='folder'&&!q){
    const details=el('details','ada-start-folder'),summary=el('summary','',item.name);
    const children=el('div','ada-start-children');
    details.append(summary,children);draw(item.children||[],children);
    parent.append(details);summary.oncontextmenu=e=>context(e,item);
   }else parent.append(shortcut(item));
  }
 }
 draw(items,list);
 if(!q){
  list.append(el('p','ada-start-caption','Инструменты'));
  for(const [name,run] of Object.entries(system||{})){
   const b=el('button','ada-start-entry',name);b.onclick=run;list.append(b);
  }
  const b=el('button','ada-start-entry','＋ Создать папку');
  b.onclick=()=>createFolder(null);list.append(b);
 }
}

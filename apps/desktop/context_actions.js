import {pin,move,rename,remove} from './state.js';
/** Shortcuts and user folders are an overlay, never underlying LinkFS mutations. */
export function contextActions(item,state,{createFolder,changed}){
 const actions=[],act=(title,run)=>actions.push({title,run});
 const edit=run=>()=>{if(run()){changed();}};
 if(!item){act('Создать папку',()=>createFolder(null));return actions;}
 const personal=item.id?.startsWith('user:');
 if(personal&&item.type==='folder'){
  act('Создать подпапку',()=>createFolder(item.id));
  act('Переименовать',()=>{
   const name=prompt('Новое имя папки',item.name);
   if(name!==null)edit(()=>rename(state,item.id,name))();
  });
  act('Удалить папку (ярлыки останутся)',()=>{
   if(confirm('Удалить папку? Содержимое вернётся на рабочий стол.'))
    edit(()=>remove(state,item.id))();
  });
 }else if(personal)act('Удалить ярлык',edit(()=>remove(state,item.id)));
 else if(item.type==='app')act('Создать ярлык на рабочем столе',edit(()=>{
  pin(state,item.view);return true;
 }));
 if(personal&&item.parent)act('На рабочий стол',edit(()=>move(state,item.id,null)));
 if(item.type==='app'||personal&&item.type==='folder'){
  const folders=state.items.filter(entry=>entry.kind==='folder'&&entry.id!==item.id);
  for(const target of folders)act('В папку: '+target.name,edit(()=>{
   if(personal)return move(state,item.id,target.id);
   pin(state,item.view,target.id);return true;
  }));
 }
 return actions;
}

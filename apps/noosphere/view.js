import {element as h,button} from '/ui/kit.js';
export async function mount(host,api){
 h('h2',host,{text:'Noosphere 3.0'});
 const state=h('p',host,{className:'mas-note',text:'Проверка состояния...'});
 const details=h('pre',host,{className:'mas-note'});
 async function refresh(){
  try{
   const data=await api.call('noosphere.status');
   state.textContent=data.persistent?'Хранилище доступно':'Без хранилища: только проверка записей';
   details.textContent=JSON.stringify(data,null,2);
  }catch(e){state.textContent='Недоступно: '+e.message;}
 }
 button(host,'Обновить состояние',refresh);
 await refresh();
}

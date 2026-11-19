import {element as h,button} from '/ui/kit.js';
export async function mount(host,api){
 const title=h('h2',host,{text:'Database'}),status=h('p',host,{className:'mas-note',text:'Подключение...'});
 const output=h('pre',host,{className:'mas-note'});
 const refresh=async()=>{
  try{const v=await api.call('database.status');status.textContent='Локальный графовый журнал';output.textContent=JSON.stringify(v,null,2);}
  catch(e){status.textContent='Недоступно: '+e.message;}
 };
 button(host,'Обновить состояние',refresh);await refresh();
}

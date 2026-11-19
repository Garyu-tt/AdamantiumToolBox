export async function mount(host,api){
 const el=(tag,txt,root=host)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;root.append(x);return x;};
 const panel=el('section');const header=el('div',undefined,panel);header.className='mas-toolbar';
 el('h2','CPU World — тестовый мир',header);
 const refresh=el('button','Обновить',header);const status=el('p','',panel);
 el('p','Внимание: только проверочная среда. Genesis не подключён.',panel).className='mas-note';
 async function show(){
  try{const obs=await api.call('danteworld.observe');status.textContent='Тик: '+obs.tick+' · Позиция: '+obs.position+' · Цель: '+obs.target;}
  catch(e){status.textContent='Недоступно: '+e.message;}
 }
 refresh.onclick=show;
 await show();
}

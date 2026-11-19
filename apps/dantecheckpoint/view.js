export async function mount(host,api){
 const el=(tag,text,p=host)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;p.append(x);return x;};
 const root=el('section'),head=el('div',undefined,root);head.className='mas-toolbar';
 el('h2','Данте — контрольные точки',head);const refresh=el('button','Проверить',head);
 const status=el('p','',root);el('p','Хранение состояния ≠ активированный Genesis.',root).className='mas-note';
 async function show(){try{const s=await api.call('dantecheckpoint.status');
  status.textContent=s.exists?'Есть снимок · версия '+s.revision:'Состояние ещё не сохранено';}
  catch(e){status.textContent='Недоступно: '+e.message;}}
 refresh.onclick=show;await show();
}

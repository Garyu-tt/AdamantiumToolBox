export async function mount(host,api){
 const el=(tag,text,p=host)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;p.append(x);return x;};
 const section=el('section');const toolbar=el('div',undefined,section);toolbar.className='mas-toolbar';
 el('h2','Сенсорная очередь',toolbar);const refresh=el('button','Проверить',toolbar);
 const message=el('p','',section);
 async function show(){try{const q=await api.call('dantesensory.status');
  message.textContent='Ожидают: '+q.queued+' / '+q.capacity+' · Источники: '+q.sources+' · Режим: '+q.delivery;}
  catch(e){message.textContent='Ошибка: '+e.message;}}
 refresh.onclick=show;await show();
}

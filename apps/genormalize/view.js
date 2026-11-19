export async function mount(host,api){
 const make=(tag,text,p=host)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;p.append(el);return el;};
 const panel=make('section');make('h2','Genesis: сенсорный нормализатор',panel);
 make('p','Самостоятельный провайдер данных. Когнитивный движок не запущен.',panel).className='mas-note';
 const status=make('p','',panel);
 status.textContent=api.graph().nodes.some(x=>x.id==='genormalize.normalize')?'Контракт доступен':'Нет разрешения на нормализацию';
}

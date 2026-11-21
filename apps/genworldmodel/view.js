export async function mount(host,api){
 const create=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 const panel=create('section');create('h2','Genesis: модель наблюдений',panel);
 create('p','CPU-микроплагин для отслеживания числовых признаков. Не идентифицирует реальные объекты и не запускает Genesis.',panel).className='mas-note';
 create('p',api.graph().nodes.some(x=>x.id==='genworldmodel.update')?
  'Контракт обновления доступен':'Контракт недоступен по текущим правам',panel);
}

export async function mount(host,api){
 const make=(tag,text,parent=host)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 const pane=make('section');make('h2','Genesis: временная интеграция',pane);
 make('p','Детерминированная обработка сигналов. Контекст сохраняет вызывающий компонент; Genesis ещё не активирован.',pane).className='mas-note';
 const status=make('p','',pane);
 status.textContent=api.graph().nodes.some(n=>n.id==='genintegrate.integrate')?'Контракт доступен':'Нет доступа к контракту';
}

export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 const panel=add('section');add('h2','Genesis: Self-State',panel);
 add('p','Только проверка и формирование снимка. Долговременное хранение и Genesis находятся в других плагинах.',panel).className='mas-note';
 add('p',api.graph().nodes.some(n=>n.id==='genselfstate.snapshot')?'Контракт доступен':'Контракт недоступен',panel);
}

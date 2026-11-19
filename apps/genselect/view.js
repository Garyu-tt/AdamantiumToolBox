export async function mount(host,api){
 const make=(tag,value,parent=host)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;parent.append(x);return x;};
 const panel=make('section');make('h2','Genesis: выбор допустимого варианта',panel);
 make('p','Чистая рекомендация: approved=false, executable=false. Выполнения действий здесь нет.',panel).className='mas-note';
 make('p',api.graph().nodes.some(n=>n.id==='genselect.select')?'Контракт доступен':'Нет доступа к контракту',panel);
}

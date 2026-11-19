export async function mount(host,api){
 const make=(tag,value,parent=host)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;parent.append(x);return x;};
 const panel=make('section');make('h2','Genesis: виртуальные варианты действий',panel);
 make('p','Только предложения в симуляции. Нет права исполнять действия или запускать Genesis.',panel).className='mas-note';
 make('p',api.graph().nodes.some(n=>n.id==='genpropose.propose')?'Контракт доступен':'Нет доступа к контракту',panel);
}

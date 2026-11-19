import {inspectComposition} from './composition.js';
export async function mount(host,api){
 const create=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 const root=create('section');root.className='dante-app';
 const toolbar=create('div',undefined,root);toolbar.className='mas-toolbar';
 create('h2','Данте — составное приложение',toolbar);
 const refresh=create('button','Проверить возможности',toolbar);
 const status=create('p','Проверка...',root);status.className='mas-note';
 const stages=create('div',undefined,root);stages.className='mas-list';
 const warning=create('p','',root);warning.className='mas-note';
 let busy=false;
 async function render(){
  if(busy||!host.isConnected)return;
  busy=true;
  try{
   const local=inspectComposition(api.graph());
   stages.replaceChildren();
   for(const stage of local.stages){
    const row=create('div',undefined,stages);row.className='mas-list-row';
    create('strong',stage.title+' — '+stage.status,row);
    create('small',stage.providers.join(', ')||stage.contract,row);
   }
   const live=await api.call('dante.status');
   status.textContent=local.discovered?'Контракты обнаружены, запуск не подтверждён':
    'Микроплагины ещё не подключены (или не видны по правам)';
   warning.textContent=live.live?'Работает':'Genesis НЕ запущен: только составная оболочка';
  }catch(error){status.textContent='Проверка недоступна: '+error.message;}
  finally{busy=false;}
 }
 refresh.onclick=render;
 await render();
 const poll=setInterval(()=>{if(!host.isConnected){clearInterval(poll);return;}
  if(document.visibilityState==='visible')render();},3000);
}

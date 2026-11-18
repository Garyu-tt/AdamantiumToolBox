export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','Leonardo · Graphics Router');
 const info=add('p','Обнаружение графических движков…');
 const list=add('div'),form=add('div'),result=add('pre','');
 const title=add('input',undefined,form);title.placeholder='Промпт или описание иконки';
 const kind=add('select',undefined,form);
 for(const name of ['icon','image','video','render']){const opt=add('option',name,kind);opt.value=name;}
 const key=add('input',undefined,form);key.placeholder='ID иконки приложения (например browser)';
 const submit=add('button','Запустить',form),refresh=add('button','Обновить провайдеры');
 const preview=add('img');preview.alt='Предпросмотр последней иконки';preview.style.maxWidth='128px';
 async function providers(){
  const providers=await api.call('leonardo.providers');
  info.textContent=providers.length?'Доступных операций: '+providers.length:'Провайдеры не подключены';
  list.replaceChildren();
  for(const p of providers)add('p',p.kind+' · '+p.id+' · '+p.formats.join(', '),list);
 }
 refresh.onclick=()=>providers().catch(e=>info.textContent=e.message);
 submit.onclick=async()=>{
  try{
   const action=kind.value==='icon'?'leonardo.icons.regenerate':'leonardo.generate';
   const params={kind:kind.value,key:key.value,prompt:title.value};
   result.textContent=JSON.stringify(await api.call(action,params),null,2);
   if(action==='leonardo.icons.regenerate'){
    const icon=await api.call('leonardo.icons.get',{key:key.value});
    if(icon.found)preview.src=icon.dataUri;
   }
  }catch(e){result.textContent=e.message;}
 };
 if(!api.graph().nodes.some(n=>n.id==='leonardo.icons.regenerate'))kind.querySelector('option[value="icon"]').disabled=true;
 if(!api.graph().nodes.some(n=>n.id==='leonardo.generate')){submit.disabled=true;}
 await providers().catch(e=>info.textContent=e.message);
}

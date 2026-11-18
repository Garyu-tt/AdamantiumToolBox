export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 const has=id=>api.graph().nodes.some(n=>n.type==='action'&&n.id===id);
 add('h2','Leonardo · Graphics Router');
 const info=add('p','Проверка графических движков…');
 const form=add('div'),prompt=add('textarea',undefined,form);
 prompt.placeholder='Описание графической задачи';prompt.rows=3;
 const kinds=add('select',undefined,form),providers=add('select',undefined,form);
 const key=add('input',undefined,form);key.placeholder='ID иконки приложения';
 const remoteLabel=add('label','Разрешить удалённый движок',form);
 const remote=add('input',undefined,remoteLabel);remote.type='checkbox';
 const submit=add('button','Создать',form);
 const refresh=add('button','Обновить провайдеры',host);
 const output=add('pre','',host),preview=add('img',undefined,host);
 preview.alt='Предпросмотр графики';preview.style.maxWidth='192px';preview.hidden=true;
 add('h3','Задания',host);const reloadJobs=add('button','Обновить задания',host);
 const jobsList=add('div','',host);
 let available=[];
 const show=value=>{
  const clone={...value};
  if(clone.artifact?.data)clone.artifact={mime:clone.artifact.mime,
   encoding:clone.artifact.encoding,bytesApprox:Math.floor(clone.artifact.data.length*3/4)};
  output.textContent=JSON.stringify(clone,null,2);
 };
 function options(select,items){
  select.replaceChildren();
  for(const item of items){
   const opt=add('option',item.label,select);opt.value=item.value;
  }
 }
 function selectKind(){
  const kind=kinds.value;
  const found=available.filter(x=>x.kind===kind);
  options(providers,[{value:'',label:'Автоматический выбор'},
   ...found.map(p=>({value:p.id,label:p.id+' ('+p.locality+')'}))]);
  key.hidden=kind!=='icon';submit.disabled=!found.length;
 }
 async function updateProviders(){
  available=await api.call('leonardo.providers');
  const variants=[...new Set(available.map(x=>x.kind))];
  options(kinds,variants.map(kind=>({value:kind,label:kind})));
  info.textContent=available.length?'Провайдеров: '+available.length:
   'Графические движки не подключены';
  selectKind();
 }
 async function refreshJobs(){
  jobsList.replaceChildren();
  if(!has('leonardo.jobs.list'))return;
  const jobs=await api.call('leonardo.jobs.list');
  if(!jobs.length){add('p','Нет заданий',jobsList);return;}
  for(const task of jobs){
   const row=add('div',task.kind+' · '+task.status+' · '+task.id,jobsList);
   const status=add('button','Статус',row);
   status.onclick=async()=>{try{show(await api.call('leonardo.jobs.status',{jobId:task.id}));}
    catch(e){output.textContent=e.message;}};
   if(has('leonardo.jobs.cancel')&&!['completed','failed','cancelled'].includes(task.status)){
    const cancel=add('button','Отменить',row);
    cancel.onclick=async()=>{try{show(await api.call('leonardo.jobs.cancel',{jobId:task.id}));await refreshJobs();}
     catch(e){output.textContent=e.message;}};
   }
  }
 }
 kinds.onchange=selectKind;
 refresh.onclick=()=>updateProviders().catch(e=>info.textContent=e.message);
 reloadJobs.onclick=()=>refreshJobs().catch(e=>output.textContent=e.message);
 submit.onclick=async()=>{
  try{
   const isIcon=kinds.value==='icon';
   const params={kind:kinds.value,prompt:prompt.value,allowRemote:remote.checked};
   if(providers.value)params.providerId=providers.value;
   if(isIcon)params.key=key.value;
   const action=isIcon?'leonardo.icons.regenerate':'leonardo.generate';
   const result=await api.call(action,params);show(result);
   preview.hidden=true;
   if(isIcon&&result.status==='completed'){
    const icon=await api.call('leonardo.icons.get',{key:key.value});
    if(icon.found){preview.src=icon.dataUri;preview.hidden=false;}
   }else if(result.artifact?.mime==='image/png'&&
    result.artifact?.encoding==='base64'){
    preview.src='data:image/png;base64,'+result.artifact.data;preview.hidden=false;
   }
   if(result.status==='queued')await refreshJobs();
  }catch(e){output.textContent=e.message;}
 };
 await updateProviders().catch(e=>info.textContent=e.message);
 await refreshJobs().catch(e=>output.textContent=e.message);
}

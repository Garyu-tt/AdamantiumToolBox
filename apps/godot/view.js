export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const n=document.createElement(tag);
  if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 add('h2','Godot · World Engine');
 const state=add('p','Поиск доступных движков…');
 const select=add('select'),reload=add('button','Обновить');
 const project=add('input');project.placeholder='ID проекта (каталог)';
 const inspect=add('button','Проверить движок');
 const check=add('button','Проверить проект');
 const start=add('button','Запустить headless');
 const status=add('button','Статус сессии');
 const stop=add('button','Остановить');
 const output=add('pre','');
 let active=null,available=[];
 const has=id=>api.graph().nodes.some(n=>n.type==='action'&&n.id===id);
 function show(value){output.textContent=JSON.stringify(value,null,2);}
 function controls(){
  const id=select.value;
  inspect.disabled=!id||!has('godot.engine.inspect');
  check.disabled=!id||!has('godot.project.check');
  start.disabled=!id||!has('godot.session.start')||
   !available.some(p=>p.id===id&&p.operations?.['session.start']);
  status.disabled=!active||!has('godot.session.status');
  stop.disabled=!active||!has('godot.session.stop');
 }
 async function refresh(){
  const previous=select.value,items=await api.call('godot.providers');
  available=items;
  select.replaceChildren();
  for(const p of items){const op=add('option',p.id+' · '+p.engine+' · '+p.locality,select);op.value=p.id;}
  if(items.some(x=>x.id===previous))select.value=previous;
  state.textContent=items.length?'Провайдеров: '+items.length:
   'Движок не подключён. Установите независимый backend.';
  controls();
 }
 async function call(action,params){
  try{const value=await api.call(action,params);show(value);return value;}
  catch(e){output.textContent=e.message;return null;}
 }
 select.onchange=controls;
 reload.onclick=()=>refresh().catch(e=>state.textContent=e.message);
 inspect.onclick=()=>call('godot.engine.inspect',{providerId:select.value});
 check.onclick=()=>call('godot.project.check',{providerId:select.value,projectId:project.value});
 start.onclick=async()=>{
  const value=await call('godot.session.start',{providerId:select.value,projectId:project.value,
   profile:'headless'});
  if(value?.sessionId)active={providerId:value.providerId,sessionId:value.sessionId};
  controls();
 };
 status.onclick=()=>active&&call('godot.session.status',active);
 stop.onclick=async()=>{if(active)await call('godot.session.stop',active);controls();};
 api.onGraphChange?.(()=>refresh().catch(e=>state.textContent=e.message));
 await refresh().catch(e=>state.textContent=e.message);
}

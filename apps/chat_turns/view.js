export async function mount(host,api){
 const title=document.createElement('h3'),status=document.createElement('small');
 const detail=document.createElement('pre'),stop=document.createElement('button');
 title.textContent='Очередь и прерывания';stop.textContent='Запросить прерывание';
 host.append(title,status,detail,stop);let thread=null,active=null;
 const source=()=>api.graph().nodes.find(x=>x.type==='resource'&&x.protocol==='conversation-turns-1');
 const allowed=id=>api.graph().nodes.some(x=>x.id===id&&x.type==='action');
 const store=()=>api.graph().nodes.find(x=>x.type==='resource'&&x.protocol==='conversation-store-1');
 let syncing=false;
 async function recover(){
  const src=store(),turns=source();if(!src||!turns||!thread||!allowed(src.actions.read)||!allowed(turns.actions.register))return;
  let after=0;
  for(let page=0;page<100;page++){
   const data=await api.call(src.actions.read,{thread,after});
   if(!data.messages?.length)return;
   for(const m of data.messages)if(m.role==='user')await api.call(turns.actions.register,{
    thread,sourceId:m.id,sourceSeq:m.seq,opId:'sync-'+m.id});
   after=data.messages.at(-1).seq;if(data.messages.length<200)return;
  }
  throw Error('sync_page_limit');
 }
 async function render(){const src=source();stop.disabled=true;
  if(!src||!allowed(src.actions.status)){status.textContent='Контроллер недоступен';detail.textContent='';return;}
  if(!thread){status.textContent='Выбери чат';detail.textContent='';return;}
  try{const data=await api.call(src.actions.status,{thread});active=data.active;
   status.textContent='Необработанных сообщений: '+data.pending;
   detail.textContent=active?'Генерация '+active.id+' · '+(active.interruptRequested?'Прерывание запрошено':'В работе'):'Нет активной генерации';
   stop.disabled=!active||active.interruptRequested||!allowed(src.actions.interrupt);
  }catch(e){status.textContent=e.message;}
 }
 stop.onclick=async()=>{const src=source();if(!src||!active)return;
  stop.disabled=true;
  try{await api.call(src.actions.interrupt,{thread,turnId:active.id,opId:crypto.randomUUID()});
   await render();}catch(e){status.textContent=e.message;}
 };
 window.addEventListener('mas-chat-selected-1',async e=>{thread=e.detail?.thread;
  if(syncing)return;syncing=true;try{await recover();}catch(err){status.textContent='Восстановление очереди: '+err.message;}
  finally{syncing=false;}await render();},{signal:host._masSignal});
 window.addEventListener('mas-chat-updated-1',render,{signal:host._masSignal});
 await render();
}

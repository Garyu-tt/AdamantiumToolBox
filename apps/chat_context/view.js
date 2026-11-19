export async function mount(host,api){
 const heading=document.createElement('h3'),status=document.createElement('small'),summary=document.createElement('pre');
 heading.textContent='Контрольные снимки';host.append(heading,status,summary);let thread=null;
 const provider=()=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol==='conversation-checkpoints-1');
 const store=()=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol==='conversation-store-1');
 const allowed=id=>api.graph().nodes.some(n=>n.id===id&&n.type==='action');
 async function render(){const c=provider(),s=store();
  if(!thread){status.textContent='Выбери чат';summary.textContent='';return;}
  if(!c||!allowed(c.actions.read)){status.textContent='Контекст-провайдер недоступен';return;}
  try{const result=await api.call(c.actions.read,{thread}),latest=result.latest;
   summary.textContent=latest?.summary||'Снимок ещё не создан. Исходные сообщения сохраняются в журнале.';
   status.textContent=latest?'Версия '+latest.version+' · '+latest.sourceCount+' сообщений':'Нет сохранённых снимков';
   if(s&&allowed(s.actions.list)&&allowed(c.actions.due)){
    const threads=await api.call(s.actions.list),t=threads.threads.find(x=>x.id===thread);
    if(t){const due=await api.call(c.actions.due,{thread,messageCount:t.count});
     if(due.due)status.textContent+=' · Требуется обновление контекста';}
   }
  }catch(e){status.textContent='Ошибка: '+e.message;}
 }
 window.addEventListener('mas-chat-selected-1',e=>{thread=e.detail?.thread;render();},{signal:host._masSignal});
 window.addEventListener('mas-chat-updated-1',render,{signal:host._masSignal});
 await render();
}

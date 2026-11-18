export async function mount(host,api){
 const make=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 make('h2','Mechanicus Gauntlet');
 make('p','Подписанные результаты CI, блокеры Fixiki и очередь релиз-кандидатов.');
 const refresh=make('button','Обновить'),queue=make('small',''),panel=make('section');
 async function redraw(){
  const cases=await api.call('gauntlet.list',{});
  const pending=await api.call('gauntlet.outbox',{kind:'fixiki-outbox'});
  queue.textContent='Fixiki: '+pending.length+' ожидают подтверждения доставки';
  panel.replaceChildren();
  for(const c of cases){
   const box=make('article',undefined,panel);
   make('strong',c.task_id+' — '+c.status,box);
   make('p',c.issues.join(', ')||'Нет зарегистрированных ошибок',box);
   make('small',c.sha256+' · '+c.attempts+' попытка(и)',box);
   if(c.diagnostic){
    const show=make('button','Диагностика',box);
    const details=make('pre','',box);details.hidden=true;
    show.onclick=async()=>{
     if(!details.hidden){details.hidden=true;return;}
     try{const r=await api.call('gauntlet.detail',{task_id:c.task_id});
      details.textContent=JSON.stringify(r.diagnostic,null,2);details.hidden=false;
     }catch(e){details.textContent=e.message;details.hidden=false;}
    };
   }
  }
 }
 refresh.onclick=()=>redraw().catch(e=>{panel.textContent=e.message;});
 await redraw().catch(e=>{panel.textContent=e.message;});
 const interval=setInterval(()=>{if(!host.isConnected)return clearInterval(interval);
  redraw().catch(()=>{});},5000);
}

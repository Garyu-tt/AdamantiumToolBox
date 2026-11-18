export async function mount(host,api){
 const make=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 make('h2','Mechanicus Gauntlet');
 make('p','Подписанные результаты CI, блокеры Fixiki и очередь релиз-кандидатов.');
 const refresh=make('button','Обновить'),panel=make('section');
 async function redraw(){
  const cases=await api.call('gauntlet.list',{});
  panel.replaceChildren();
  for(const c of cases){
   const box=make('article',undefined,panel);
   make('strong',c.task_id+' — '+c.status,box);
   make('p',c.issues.join(', ')||'Нет зарегистрированных ошибок',box);
   make('small',c.sha256+' · '+c.attempts+' попытка(и)',box);
  }
 }
 refresh.onclick=()=>redraw().catch(e=>{panel.textContent=e.message;});
 await redraw().catch(e=>{panel.textContent=e.message;});
 const interval=setInterval(()=>{if(!host.isConnected)return clearInterval(interval);
  redraw().catch(()=>{});},5000);
}

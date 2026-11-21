export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
 const h=add('section');h.className='factory-diagnostics';
 add('h2','Диагностика ответов',h);
 const bar=add('div',undefined,h);bar.className='mas-toolbar';
 const refresh=add('button','Обновить',bar);
 const filter=add('select',undefined,bar);filter.setAttribute('aria-label','Сессия');
 const copy=add('button','Копировать журнал',bar);
 const state=add('p','Загрузка',h),details=add('div',undefined,h);
 let shown=[];let chosen='';
 async function load(){
  refresh.disabled=true;copy.disabled=true;state.textContent='Чтение реальных событий…';details.replaceChildren();
  try{
   const sessions=await api.call('factory-diagnostics.sessions');
   filter.replaceChildren();
   let option=add('option','Все сессии',filter);option.value='';
   for(const s of sessions.sessions||[]){option=add('option',s.agent_id+' / '+s.session_id,filter);option.value=s.session_id;}
   if(!(sessions.sessions||[]).some(s=>s.session_id===chosen))chosen='';filter.value=chosen;
   const data=await api.call('factory-diagnostics.events',chosen?{session_id:chosen}:{limit:100});
   shown=data.events||[];
   if(data.source!=='connected')state.textContent='Журнал недоступен: '+data.source+' (сообщения не получены)';
   else state.textContent='Реальных событий: '+shown.length+(data.partial?' · показан только конец файла':'')+(data.invalid_records?' · некорректных записей: '+data.invalid_records:'');
   if(data.source==='connected'&&!shown.length)add('p','Пока нет подтверждённых ответов или действий',details);
   for(const e of shown){
    const block=add('article',undefined,details);block.style.cssText='padding:9px;margin:6px 0;border:1px solid #8885;border-radius:7px;overflow-wrap:anywhere';
    add('strong',e.at+' · '+e.agent_id+' · '+e.session_id+' · '+e.type,block);
    if(e.text)add('pre',e.text,block).style.whiteSpace='pre-wrap';
    if(e.github_url){const link=add('a','Открыть GitHub',block);link.href=e.github_url;link.target='_blank';link.rel='noopener noreferrer';}
    const usage=e.usage||{};
    if(e.type==='usage'||usage.cost_usd!==null)add('small','Токены: '+(usage.input_tokens??'unknown')+'/'+(usage.output_tokens??'unknown')+' · Цена: '+(usage.cost_usd===null?'unknown':('$'+usage.cost_usd)),block);
   }
   copy.disabled=!shown.length;
  }catch{state.textContent='Нет доступа к диагностике или ошибка подключения';}
  finally{refresh.disabled=false;}
 }
 refresh.onclick=load;filter.onchange=()=>{chosen=filter.value;load();};
 copy.onclick=()=>navigator.clipboard?.writeText(JSON.stringify(shown,null,2)).catch(()=>{state.textContent='Не удалось скопировать журнал';});
 await load();
}

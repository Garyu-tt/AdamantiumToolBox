// Composite UI; live skill actions only, no cross-app imports or fixed ports.
export async function gesturesPanel(host,api,motor,planner,wave,allowed){
 const m=motor?.skill?.actions,g=planner?.skill?.actions,w=wave?.skill?.actions;
 if(!m?.status||!g?.plan||!w?.render||
  !allowed.has(m.status)||!allowed.has(g.plan)||!allowed.has(w.render))return;
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h3','Плавная речь из выученных звуков');
 const info=add('pre','Загрузите выученные моторные навыки');
 const chooser=add('select'),duration=add('select'),pause=add('select');
 for(const ms of [160,240,320,480]){
  const o=add('option',ms+' мс',duration);o.value=String(ms);
 }
 for(const [title,ms] of [['Без паузы',0],['Пауза 150 мс',150]]){
  const o=add('option',title,pause);o.value=String(ms);
 }
 const selected=[];
 const show=()=>{info.textContent=selected.length?
  'Порядок: '+selected.map(x=>x.id+' ('+x.durationMs+' мс)').join(' → '):
  'Добавьте два или больше выученных звуков';};
 const refresh=add('button','Обновить выученные звуки');
 let records=[];
 refresh.onclick=async()=>{
  try{
   const memory=await api.call(m.status);
   records=memory.records.filter(x=>x?.trials>0&&Number.isFinite(x.loss));
   chooser.replaceChildren();
   for(const r of records){
    const o=add('option',r.id+' · ошибка '+r.loss.toFixed(4),chooser);
    o.value=r.id;
   }
   info.textContent=records.length?'Освоено моторных образов: '+records.length:
    'Пока нет моторных навыков. Сначала обучите артикуляцию.';
  }catch(e){info.textContent=String(e.message);}
 };
 const push=add('button','Добавить звук в цепочку');
 push.onclick=()=>{
  if(selected.length>=6){info.textContent='Максимум шесть звуков';return;}
  const id=chooser.value;
  if(!records.some(r=>r.id===id)){info.textContent='Выберите изученный звук';return;}
  selected.push({id,durationMs:Number(duration.value),pauseMs:Number(pause.value)});
  show();
 };
 const clear=add('button','Очистить цепочку');
 clear.onclick=()=>{selected.length=0;show();};
 const player=add('audio');player.controls=true;
 const play=add('button','Произнести звуковую цепочку');
 let busy=false;
 play.onclick=async()=>{
  if(busy)return;
  if(selected.length<2){info.textContent='Нужно минимум два звука';return;}
  busy=true;play.disabled=true;
  try{
   const fresh=await api.call(m.status);
   const byId=new Map(fresh.records.map(x=>[x.id,x]));
   const steps=selected.map((x,i)=>{
    const record=byId.get(x.id);
    if(!record?.best||!Number.isFinite(record.loss))
     throw Error('Моторный навык недоступен: '+x.id);
    return {motor:record.best,durationMs:x.durationMs,
     pauseMs:i===selected.length-1?0:x.pauseMs};
   });
   const timeline=await api.call(g.plan,{steps,transitionMs:80});
   const voice=await api.call(w.render,{trajectory:timeline});
   player.src='data:'+voice.mime+';base64,'+voice.audioBase64;
   info.textContent='Непрерывный звук: '+voice.durationMs+
    ' мс · '+voice.provider+' · высота '+voice.anchorHz+' Гц';
  }catch(e){info.textContent=String(e.message);}
  finally{busy=false;play.disabled=false;}
 };
 await refresh.onclick();
}

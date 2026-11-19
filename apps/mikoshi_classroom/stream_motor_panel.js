import {imitateEvents} from './stream_imitation.js';
// A separate, opt-in write action; no motor training during listening.
export function streamMotorPanel(host,api,roles,allowed,getLesson){
 const requested={articulation:['observe','preview'],
  motor:['propose','feedback','status'],gesture:['plan'],wave:['render']};
 const skills={};
 for(const [role,names] of Object.entries(requested)){
  const provider=roles[role],actions=provider?.skill?.actions;
  if(!actions||names.some(name=>!allowed.has(actions[name])))return;
  skills[role]=Object.fromEntries(names.map(name=>[name,actions[name]]));
 }
 const add=(tag,t)=>{const el=document.createElement(tag);
  if(t!==undefined)el.textContent=t;host.append(el);return el;};
 add('h4','Учебное воспроизведение услышанного');
 const approval=add('label','Разрешаю моторное обучение по текущему образцу');
 const check=document.createElement('input');check.type='checkbox';approval.append(check);
 const result=add('pre','Сначала явно обучите слуховую память');
 const audio=add('audio');audio.controls=true;
 const start=add('button','Попробовать произнести услышанные звуки');
 let busy=false;
 start.onclick=async()=>{
  if(busy)return;
  const lesson=getLesson();
  if(!check.checked){result.textContent='Нужно разрешение на обучение';return;}
  if(!lesson||lesson.length<2||lesson.length>6){
   result.textContent='Нужно 2–6 освоенных звуковых событий';return;
  }
  busy=true;start.disabled=true;check.checked=false;
  try{
   const r=await imitateEvents(api,skills,lesson,msg=>{result.textContent=msg;});
   audio.src='data:'+r.mime+';base64,'+r.audioBase64;
   result.textContent='Попытка из '+r.events+' звуков, '+r.durationMs+
    ' мс. Это ещё не человеческая речь.';
  }catch(e){result.textContent=String(e.message)+
   '\nПри ошибке проверьте состояние памяти до нового запуска.';}
  finally{busy=false;start.disabled=false;}
 };
}

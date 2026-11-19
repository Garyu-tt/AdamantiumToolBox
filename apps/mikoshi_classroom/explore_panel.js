import {explore} from './explore_engine.js';
// User explicitly starts bounded trials; no microphone or hidden timers here.
export function explorePanel(host,api,providers,available,getLesson,world){
 const needs={explorer:['begin','choose','feedback','stop','status'],
  motor:['propose','feedback','status'],articulation:['observe','preview']};
 const skills={};
 for(const [role,names] of Object.entries(needs)){
  const actions=providers[role]?.skill?.actions;
  if(!actions||names.some(name=>!available.has(actions[name])))return;
  skills[role]=Object.fromEntries(names.map(name=>[name,actions[name]]));
 }
 const future=world?.skill?.actions;
 if(future&&['forecast','observe','abort','status'].every(
  name=>available.has(future[name])))
  skills.world=Object.fromEntries(
   ['forecast','observe','abort','status'].map(name=>[name,future[name]]));
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h4','Исследование звуков — выбор эксперимента');
 const approval=add('label','Разрешаю ограниченный учебный сеанс');
 const check=add('input',undefined,approval);check.type='checkbox';
 const amount=add('select');
 for(const n of [4,6,8,10,12]){const opt=add('option',n+' шага',amount);opt.value=String(n);}
 amount.value='6';
 const output=add('pre',skills.world?'Прогнозирование подключено':'Прогнозирование пока недоступно');
 const start=add('button','Самостоятельно выбрать учебные шаги');
 const cancel=add('button','Остановить после шага');cancel.disabled=true;
 const recover=add('button','Остановить сохранённый сеанс');
 let busy=false,stopping=false;
 cancel.onclick=()=>{stopping=true;output.textContent='Остановка после текущего действия';};
 recover.onclick=async()=>{
  if(busy)return;
  try{
   const state=await api.call(skills.explorer.status);
   if(state.session?.status!=='active'){
    output.textContent='Активного сеанса нет';return;
   }
   if(!check.checked){output.textContent='Требуется разрешение';return;}
   await api.call(skills.explorer.stop,{sessionId:state.session.id,
    sourceApproved:true});
   check.checked=false;output.textContent='Предыдущий сеанс остановлен.';
  }catch(e){output.textContent=String(e.message);}
 };
 start.onclick=async()=>{
  if(busy)return;
  if(!check.checked){output.textContent='Подтвердите разрешение';return;}
  const items=getLesson();
  if(!items||items.length<2){
   output.textContent='Нужно предварительно изучить минимум два звука';return;
  }
  busy=true;stopping=false;start.disabled=true;cancel.disabled=false;
  check.checked=false;
  try{
   const r=await explore(api,skills,items,Number(amount.value),
    msg=>{output.textContent=msg;},()=>stopping);
   output.textContent='Состояние: '+r.status+'\nРешения:\n'+
    r.decisions.map(d=>d.id+' → '+d.action+
     ' (ошибка '+d.loss.toFixed(4)+
     (d.predicted?', ошибка прогноза '+d.predictionError:'')+
     (d.surprise?', неожиданность':'')+')').join('\n');
  }catch(e){output.textContent=String(e.message)+
   '\nПеред повторным запуском проверьте состояние обучения.';}
  finally{busy=false;start.disabled=false;cancel.disabled=true;}
 };
}

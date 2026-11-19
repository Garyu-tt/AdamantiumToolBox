import {commitAV,inspectAV} from './av_commit.js';
import {captureAV} from './av_capture.js';
// Optional in-memory composition; only browser owns camera/microphone tracks.
export function liveAVPanel(host,api,providers,allowed){
 const want={vision:['analyze'],audio:['analyze'],sync:['align']},skills={};
 for(const [role,names] of Object.entries(want)){
  const actions=providers[role]?.skill?.actions;
  if(!actions||names.some(n=>!allowed.has(actions[n])))return;
  skills[role]=Object.fromEntries(names.map(n=>[n,actions[n]]));
 }
 const memory=providers.memory?.skill?.actions||{};
 const grounding=providers.grounding?.skill?.actions||{};
 const policy=providers.policy?.skill?.actions||{};
 const writer={remember:memory.remember,teach:grounding.teach,
  motifReceipt:memory.receipt,groundingReceipt:grounding.receipt,policy};
 const canTeach=Boolean(policy.authorize&&policy.verify&&
  [writer.remember,writer.teach,writer.motifReceipt,writer.groundingReceipt,
   policy.authorize,policy.verify].every(x=>allowed.has(x)));

 const tracking=providers.tracking?.skill?.actions?.track;
 const canTrack=Boolean(tracking&&allowed.has(tracking));
 const add=(tag,value,parent=host)=>{const el=document.createElement(tag);
  if(value!==undefined)el.textContent=value;parent.append(el);return el;};
 add('h3','Камера + микрофон: один короткий опыт');
 add('p','Захват 2 секунды только по нажатию. Временная привязка приблизительная.');
 const info=add('pre','Ничего не записывается в долговременную память');
 const consent=canTeach?add('label','Подтверждаю согласие всех участников и отсутствие сторонних записей'):null;
 const checked=consent?add('input',undefined,consent):null;
 if(checked)checked.type='checkbox';
 const captureButton=add('button','Разрешить камеру и микрофон на 2 секунды');
 const analyze=add('button','Выделить и сопоставить события без обучения');
 const teach=canTeach?add('button','Сохранить подтверждённые совпадения'):null;
 const clear=add('button','Очистить временные образцы');
 const recover=canTeach?add('button','Проверить сохранённые пары'):null;
 let capture=null,lesson=null,pending=null,busy=false;
 const call=(role,action,params)=>api.call(skills[role][action],params);
 const erase=()=>{capture=null;lesson=null;pending=null;if(checked)checked.checked=false;};
 clear.onclick=()=>{if(busy)return;erase();
  info.textContent='Временные аудио- и видеоданные очищены';};
 captureButton.onclick=async()=>{
  if(busy)return;busy=true;captureButton.disabled=true;erase();
  try{
   capture=await captureAV();
   info.textContent='Кадров: '+capture.frames.length+
    '. Временная погрешность не подтверждена; данные только в памяти.';
  }catch(e){info.textContent=String(e.message);}
  finally{busy=false;captureButton.disabled=false;}
 };
 analyze.onclick=async()=>{
  if(busy)return;
  if(!capture){info.textContent='Сначала разрешите короткую запись';return;}
  busy=true;analyze.disabled=true;lesson=null;pending=null;
  try{
   const visual=await call('vision','analyze',{frames:capture.frames});
   const audio=await call('audio','analyze',{
    samples:capture.samples,sampleRate:12000});
   const pairing=await call('sync','align',{
    visualEvents:visual.events.map(e=>({timeMs:e.timeMs,kind:e.kind})),
    audioEvents:audio.events.map(e=>({timeMs:e.timeMs})),
    uncertaintyMs:capture.uncertaintyMs});
   lesson=pairing.matches.map(pair=>({
    visual:visual.events[pair.visualIndex],audio:audio.events[pair.audioIndex],
    pair}));
   let tracks='не подключён';
   if(canTrack){
    const tracked=await api.call(tracking,{frames:capture.frames});
    tracks=String(tracked.tracks.length);
   }
   info.textContent='Анонимных визуальных траекторий: '+tracks+
    '\nЗрительных событий: '+visual.detected+
    '\nЗвуковых событий: '+audio.detected+
    '\nПредварительных совпадений: '+lesson.length+
    '\nНеоднозначных/пропущенных: '+pairing.unpaired.length+
    '\nЧасы устройства: не аттестованы. Обучение отдельно.';
  }catch(e){lesson=null;info.textContent=String(e.message);}
  finally{busy=false;analyze.disabled=false;}
 };
 if(recover)recover.onclick=async()=>{
  if(busy)return;
  if(!pending){info.textContent='Нет незавершённой записи для проверки';return;}
  try{
   const rows=await inspectAV(api,writer,pending.permit,pending.count);
   info.textContent=rows.map(x=>
    'Пара '+(x.pairIndex+1)+': слух '+(x.motif?'есть':'нет')+
    ', связь '+(x.grounding?'есть':'нет')).join('\\n');
  }catch(e){info.textContent=String(e.message);}
 };
 if(teach)teach.onclick=async()=>{
  if(busy)return;
  if(!checked.checked){info.textContent='Нужно разрешение на обучение';return;}
  if(!lesson?.length){info.textContent='Нет событий для обучения';return;}
  busy=true;teach.disabled=true;checked.checked=false;
  let complete=false;
  try{
   const durationMs=Math.round(capture.samples.length/12);
   const result=await commitAV(api,writer,lesson,durationMs,
    permit=>{pending={permit,count:lesson.length};});
   info.textContent='Связано '+result.saved+' пар. Никаких слов не задано.';
   complete=true;
  }catch(e){
   info.textContent='Неизвестный результат записи. Проверьте пары;'+
    ' не повторяйте автоматически. '+String(e.message);
  }finally{
   if(complete)erase();
   busy=false;teach.disabled=false;
  }
 };
}

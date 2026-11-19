import {captureAV} from './av_capture.js';
// Optional in-memory composition; only browser owns camera/microphone tracks.
export function liveAVPanel(host,api,providers,allowed){
 const want={vision:['analyze'],audio:['analyze'],sync:['align']},skills={};
 for(const [role,names] of Object.entries(want)){
  const actions=providers[role]?.skill?.actions;
  if(!actions||names.some(n=>!allowed.has(actions[n])))return;
  skills[role]=Object.fromEntries(names.map(n=>[n,actions[n]]));
 }
 const writer={memory:providers.memory?.skill?.actions?.remember,
  grounding:providers.grounding?.skill?.actions?.teach};
 const canTeach=Boolean(writer.memory&&writer.grounding&&
  allowed.has(writer.memory)&&allowed.has(writer.grounding));
 if(canTeach){
  skills.memory={remember:writer.memory};skills.grounding={teach:writer.grounding};
 }
 const add=(tag,value,parent=host)=>{const el=document.createElement(tag);
  if(value!==undefined)el.textContent=value;parent.append(el);return el;};
 add('h3','Камера + микрофон: один короткий опыт');
 add('p','Захват 2 секунды только по нажатию. Временная привязка приблизительная.');
 const info=add('pre','Ничего не записывается в долговременную память');
 const consent=canTeach?add('label','Подтверждаю разрешение на обучение'):null;
 const checked=consent?add('input',undefined,consent):null;
 if(checked)checked.type='checkbox';
 const captureButton=add('button','Разрешить камеру и микрофон на 2 секунды');
 const analyze=add('button','Выделить и сопоставить события без обучения');
 const teach=canTeach?add('button','Сохранить подтверждённые совпадения'):null;
 const clear=add('button','Очистить временные образцы');
 let capture=null,lesson=null,busy=false;
 const call=(role,action,params)=>api.call(skills[role][action],params);
 const erase=()=>{capture=null;lesson=null;if(checked)checked.checked=false;};
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
  busy=true;analyze.disabled=true;lesson=null;
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
   info.textContent='Зрительных событий: '+visual.detected+
    '\nЗвуковых событий: '+audio.detected+
    '\nПредварительных совпадений: '+lesson.length+
    '\nНеоднозначных/пропущенных: '+pairing.unpaired.length+
    '\nЧасы устройства: не аттестованы. Обучение отдельно.';
  }catch(e){lesson=null;info.textContent=String(e.message);}
  finally{busy=false;analyze.disabled=false;}
 };
 if(teach)teach.onclick=async()=>{
  if(busy)return;
  if(!checked.checked){info.textContent='Нужно явное разрешение на обучение';return;}
  if(!lesson?.length){info.textContent='Нет однозначных событий для обучения';return;}
  busy=true;teach.disabled=true;checked.checked=false;
  let saved=0;
  try{
   const result=[];
   for(const {visual,audio,pair} of lesson){
    const heard=await call('memory','remember',{
     samples:audio.samples,sampleRate:12000,sourceApproved:true});
    const linked=await call('grounding','teach',{
     visualVector:visual.vector,soundId:heard.id,
     visualAtMs:pair.visualAtMs,soundAtMs:pair.soundAtMs,
     sourceApproved:true});
    result.push(linked.visualId+' ↔ '+heard.id);saved++;
   }
   info.textContent='Сохранено совпадений: '+saved+'\n'+result.join('\n')+
    '\nСвязи только статистические, без смысла и причинности.';
  }catch(e){info.textContent='Возможна частичная запись: '+saved+
   '. Проверьте состояние перед повтором. '+String(e.message);}
  finally{erase();busy=false;teach.disabled=false;}
 };
}

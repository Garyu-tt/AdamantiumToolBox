import {explorePanel} from './explore_panel.js';
import {streamMotorPanel} from './stream_motor_panel.js';
import {captureStream} from './stream_capture.js';
// Composite discovery only; no fixed sibling MAS imports or endpoints.
export function streamPanel(host,api,events,memory,sequence,articulation,allowed,motor,gesture,wave,explorer){
 const ev=events?.skill?.actions,mem=memory?.skill?.actions;
 if(!ev?.analyze||!allowed.has(ev.analyze))return;
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h3','Непрерывное слушание — короткие события');
 const info=add('pre','Запись и обучение запускаются только вручную');
 let source=null,detected=null,learned=null,busy=false;
 streamMotorPanel(host,api,{articulation,motor,gesture,wave},allowed,()=>learned);
 explorePanel(host,api,{explorer,articulation,motor},allowed,()=>learned);
 const capture=add('button','Записать 2 секунды с микрофона');
 capture.onclick=async()=>{
  if(busy)return;busy=true;capture.disabled=true;detected=null;learned=null;
  try{
   source=await captureStream();info.textContent='Запись в памяти: 2 секунды. '+
    'Можно выделить звуковые события, ничего не сохраняя.';
  }catch(e){source=null;info.textContent=String(e.message);}
  finally{busy=false;capture.disabled=false;}
 };
 if(articulation?.skill?.actions?.preview&&
  allowed.has(articulation.skill.actions.preview)){
  const synthetic=add('button','Создать контрольный сигнал без микрофона');
  synthetic.onclick=async()=>{
   if(busy)return;busy=true;synthetic.disabled=true;detected=null;learned=null;
   try{
    const speak=articulation.skill.actions.preview;
    const a=await api.call(speak,{motor:{f1:810,f2:1290}});
    const b=await api.call(speak,{motor:{f1:300,f2:2450}});
    source={samples:[...Array(2400).fill(0),...a.samples,
     ...Array(1200).fill(0),...b.samples,...Array(2400).fill(0)],
     sampleRate:12000,source:'synthetic-diagnostic'};
    info.textContent='Контрольный сигнал создан без записей или слов.';
   }catch(e){source=null;info.textContent=String(e.message);}
   finally{busy=false;synthetic.disabled=false;}
  };
 }
 const analyze=add('button','Выделить события без обучения');
 analyze.onclick=async()=>{
  if(busy)return;
  if(!source){info.textContent='Сначала получите аудиообразец';return;}
  busy=true;analyze.disabled=true;learned=null;
  try{
   detected=await api.call(ev.analyze,{samples:source.samples,
    sampleRate:source.sampleRate});
   info.textContent='Обнаружено событий: '+detected.detected+
    '\nМоменты: '+detected.events.map(x=>x.timeMs+' мс').join(', ')+
    '\nНичего не записано в долговременную память.';
  }catch(e){detected=null;info.textContent=String(e.message);}
  finally{busy=false;analyze.disabled=false;}
 };
 if(mem?.recognize&&allowed.has(mem.recognize)){
  const recognize=add('button','Узнать знакомые звуки без обучения');
  recognize.onclick=async()=>{
   if(!detected){info.textContent='Сначала выделите звуковые события';return;}
   try{
    const labels=[];
    for(const event of detected.events){
     const v=await api.call(mem.recognize,{samples:event.samples,sampleRate:12000});
     labels.push(v.matched?v.id:'неизвестно');
    }
    info.textContent='Образы: '+labels.join(' → ')+'\nБез сохранения.';
   }catch(e){info.textContent=String(e.message);}
  };
 }
 if(mem?.remember&&allowed.has(mem.remember)){
  const row=add('label','Подтверждаю разрешение на обучение по этому аудио');
  const consent=add('input',undefined,row);consent.type='checkbox';
  const learn=add('button','Обучить память на выделенных событиях');
  learn.onclick=async()=>{
   if(busy)return;
   if(!detected?.events.length){info.textContent='Нет событий для обучения';return;}
   if(!consent.checked){info.textContent='Не подтверждено разрешение на обучение';return;}
   busy=true;learn.disabled=true;
   const timeline=[];
   try{
    for(const event of detected.events){
     const result=await api.call(mem.remember,{samples:event.samples,
      sampleRate:12000,sourceApproved:true});
     timeline.push({id:result.id,gapMs:timeline.length?event.gapMs:0});
    }
    if(timeline.length>1&&sequence?.skill?.actions?.teach&&
     allowed.has(sequence.skill.actions.teach))
     await api.call(sequence.skill.actions.teach,{events:timeline,
      sourceApproved:true});
    learned=detected.events.map((event,i)=>({...event,id:timeline[i].id}));
    info.textContent='Закреплено образов: '+timeline.length+
     '\nПоследовательность: '+timeline.map(e=>e.id).join(' → ');
    detected=null;consent.checked=false;
   }catch(e){info.textContent='Частично завершено: '+timeline.length+
    ' звуков. Не повторяйте без проверки состояния. '+String(e.message);}
   finally{busy=false;learn.disabled=false;}
  };
 }
}

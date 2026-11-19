import {avPanel} from './av_panel.js';
import {hypothesesPanel} from './hypotheses_panel.js';
import {streamPanel} from './stream_panel.js';
import {learningLoopPanel} from './loop_panel.js';
import {gesturesPanel} from './gestures_panel.js';
import {phoneticPanel} from './phonetic_panel.js';
// Composition discovers live typed providers; no imports from other apps.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text,parent=host)=>{
  const e=document.createElement(tag);if(text!==undefined)e.textContent=text;
  parent.append(e);return e;
 };
 add('h2','Mikoshi Classroom — speech workshop');
 const input=add('textarea');input.value='Привет! Я учусь говорить.';input.maxLength=80;
 const info=add('p',''),controls=add('section'),result=add('pre');
 const audio=add('audio');audio.controls=true;
 const actions=()=>new Set(api.graph().nodes.filter(n=>n.type==='action').map(n=>n.id));
 const provider=(domain,action)=>{
  const active=actions();
  return api.graph().nodes.filter(n=>n.type==='resource'&&
   n.skill?.schema==='mikoshi.skill.v1'&&n.skill.domain===domain&&
   active.has(n.skill.actions?.[action]))
   .sort((a,b)=>(b.skill.priority||0)-(a.skill.priority||0))[0];
 };
 async function refresh(){
  controls.replaceChildren();
  const voice=provider('speech','speak'),coach=provider('prosody','suggest');
  const learning=coach?.skill.actions?.feedback;
  const teach=learning&&actions().has(learning);
  info.textContent='Голос: '+(voice?'подключён':'не найден')+
   ' · Обучение просодии: '+(coach?'подключено':'не найдено');
  if(voice){
   const say=add('button','Произнести',controls);
   say.onclick=async()=>{
    result.textContent='Синтез речи…';
    try{
     let prosody={};
     if(coach){
      const data=await api.call(coach.skill.actions.suggest,{text:input.value});
      const available=voice.skill.prosody||[];
      prosody={...(available.includes('pitchDelta')?{pitchDelta:data.pitchDelta}:{}),
       ...(available.includes('speedDelta')?{speedDelta:data.speedDelta}:{})};
     }
     const rendered=await api.call(voice.skill.actions.speak,{text:input.value,prosody});
     audio.src='data:'+rendered.mime+';base64,'+rendered.audioBase64;
     result.textContent='Голос: '+rendered.provider+'\nИнтонация: '+
      JSON.stringify(rendered.appliedProsody);
    }catch(e){result.textContent=String(e.message);}
   };
  }
  const articulation=provider('articulation','preview');
  const memory=provider('auditory-memory','recognize');
  const sequence=provider('auditory-sequence','predict');
  const motor=provider('motor-learning','propose');
  avPanel(controls,api,provider('visual-events','analyze'),
   provider('audiovisual-association','associate'),memory,articulation,actions());
  hypothesesPanel(controls,api,{hypothesis:provider('hypothesis-search','generate'),
   world:provider('world-prediction','estimate'),articulation,motor},actions());
  streamPanel(controls,api,provider('auditory-events','analyze'),memory,
   sequence,articulation,actions(),motor,provider('gesture-planner','plan'),
   provider('waveform-renderer','render'),provider('exploration','choose'),
   provider('world-prediction','estimate'));
  if(articulation)phoneticPanel(controls,api,articulation,actions(),memory,sequence,motor);
  await gesturesPanel(controls,api,motor,provider('gesture-planner','plan'),
   provider('waveform-renderer','render'),actions());
  learningLoopPanel(controls,api);
  if(teach){
   const labels=[['higher','Выше'],['lower','Ниже'],['faster','Быстрее'],
    ['slower','Медленнее'],['good','Подходит']];
   for(const [value,label] of labels){
    const b=add('button',label,controls);
    b.onclick=async()=>{
     try{const state=await api.call(learning,{text:input.value,feedback:value});
      result.textContent='Обратная связь учтена: '+JSON.stringify(state.prediction);}
     catch(e){result.textContent=String(e.message);}
    };
   }
  }
 }
 const reload=add('button','Обновить доступные возможности');
 reload.onclick=refresh;await refresh();
}

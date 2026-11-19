import {practice} from './loop_engine.js';
// UI uses only discovered skill contracts and a single explicit start action.
export function learningLoopPanel(host,api){
 const roles={articulation:['preview','observe'],memory:['remember'],
  motor:['propose','feedback','status'],sequence:['teach'],
  gesture:['plan'],wave:['render'],audiometry:['compare'],
  transition:['propose','feedback','status']};
 const nodes=api.graph().nodes||[],actions=new Set(
  nodes.filter(n=>n.type==='action').map(n=>n.id));
 const skills={},missing=[];
 for(const [domain,needed] of Object.entries(roles)){
  const candidates=nodes.filter(n=>n.type==='resource'&&
   n.skill?.schema==='mikoshi.skill.v1'&&
   n.skill.domain===({
    memory:'auditory-memory',motor:'motor-learning',
    sequence:'auditory-sequence',gesture:'gesture-planner',
    wave:'waveform-renderer',audiometry:'acoustic-feedback',
    transition:'transition-learning'}[domain]||domain));
  const selected=candidates.filter(n=>needed.every(a=>
   typeof n.skill.actions?.[a]==='string'&&actions.has(n.skill.actions[a])))
   .sort((a,b)=>(b.skill.priority||0)-(a.skill.priority||0))[0];
  if(!selected)missing.push(domain);
  else skills[domain]=Object.fromEntries(needed.map(a=>[a,selected.skill.actions[a]]));
 }
 const add=(tag,t)=>{const el=document.createElement(tag);
  if(t!==undefined)el.textContent=t;host.append(el);return el;};
 add('h3','Эксперимент: полный цикл обучения');
 const status=add('pre',missing.length?
  'Пока недоступны возможности: '+missing.join(', '):
  'Готов к учебному циклу из двух искусственных звуков. Реального микрофона нет.');
 if(missing.length)return;
 const audio=add('audio');audio.controls=true;
 const start=add('button','Начать один учебный цикл');
 const cancel=add('button','Остановить после текущего шага');cancel.disabled=true;
 let busy=false,stop=false;
 cancel.onclick=()=>{stop=true;status.textContent='Остановка после текущего вызова…';};
 start.onclick=async()=>{
  if(busy)return;
  busy=true;stop=false;start.disabled=true;cancel.disabled=false;
  try{
   const out=await practice(api,skills,msg=>{status.textContent=msg;},()=>stop);
   audio.src='data:'+out.mime+';base64,'+out.audioBase64;
   status.textContent='Слуховые образы: '+out.motifs.join(' → ')+
    '\nВыученный переход: '+out.transitionMs+' мс'+
    '\nОшибка: '+out.transitionLoss+
    '\nРезультат — учебный звук, а не человеческая речь.';
  }catch(e){
   status.textContent=String(e.message)+
    '\nПри неясном результате запроса проверьте состояние памяти, не повторяйте вслепую.';
  }finally{busy=false;start.disabled=false;cancel.disabled=true;}
 };
}

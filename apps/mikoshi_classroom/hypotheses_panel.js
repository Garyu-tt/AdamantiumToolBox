import {testHypothesis} from './hypotheses_engine.js';
// Optional composed laboratory. Nothing runs until deliberate user approval.
export function hypothesesPanel(host,api,providers,available){
 const wanted={hypothesis:['generate','rank'],
  world:['estimate','forecast','observe','status','abort'],
  articulation:['preview','observe']},skills={};
 for(const [role,names] of Object.entries(wanted)){
  const a=providers[role]?.skill?.actions;
  if(!a||names.some(name=>!available.has(a[name])))return;
  skills[role]=Object.fromEntries(names.map(name=>[name,a[name]]));
 }
 const add=(tag,value,parent=host)=>{const e=document.createElement(tag);
  if(value!==undefined)e.textContent=value;parent.append(e);return e;};
 add('h4','Исследование неизвестной артикуляции');
 const checkbox=add('label','Разрешаю один звуковой эксперимент');
 const approval=add('input',undefined,checkbox);approval.type='checkbox';
 const output=add('pre','Сначала выберите эксперимент');
 const sound=add('audio');sound.controls=true;
 const run=add('button','Предложить гипотезу и проверить её');
 const inspect=add('button','Проверить состояние модели');
 const recover=add('button','Отменить незавершённый прогноз');
 let busy=false;
 const status=()=>api.call(skills.world.status);
 inspect.onclick=async()=>{
  try{output.textContent=JSON.stringify(await status(),null,2);}
  catch(e){output.textContent=String(e.message);}
 };
 recover.onclick=async()=>{
  if(busy)return;
  if(!approval.checked){output.textContent='Для отмены нужно подтверждение';return;}
  try{
   const s=await status();
   if(!s.pendingTicket){output.textContent='Незавершённых прогнозов нет';return;}
   await api.call(skills.world.abort,{ticket:s.pendingTicket,sourceApproved:true});
   output.textContent='Прогноз отменён. Никакого повторного обучения не выполнялось.';
   approval.checked=false;
  }catch(e){output.textContent=String(e.message);}
 };
 run.onclick=async()=>{
  if(busy)return;
  if(!approval.checked){output.textContent='Требуется разрешение';return;}
  busy=true;run.disabled=true;recover.disabled=true;approval.checked=false;
  try{
   const previous=await status();
   if(previous.pendingTicket)
    throw Error('Есть незавершённый прогноз — проверьте и отмените его вручную');
   let base={f1:560,f2:1640};
   const motor=providers.motor?.skill?.actions;
   if(motor?.status&&available.has(motor.status)){
    const learned=await api.call(motor.status);
    const records=learned.records?.filter(r=>r?.best&&
     Number.isFinite(r.loss))||[];
    records.sort((a,b)=>a.loss-b.loss);
    if(records.length)base=records[0].best;
   }
   const result=await testHypothesis(api,skills,base,
    msg=>{output.textContent=msg;});
   sound.src='data:'+result.mime+';base64,'+result.audioBase64;
   output.textContent='Действие '+JSON.stringify(result.motor)+
    '\nОпытов: '+result.totalExperience+
    '\nОшибка прогноза: '+(result.predictionError??'первый опыт')+
    '\nНеожиданность: '+(result.surprise?'да':'нет');
  }catch(e){output.textContent=String(e.message)+
   '\nПри неопределённом результате проверьте прогноз перед повтором.';}
  finally{busy=false;run.disabled=false;recover.disabled=false;}
 };
}

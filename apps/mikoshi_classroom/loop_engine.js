// Graph-only composition: each provider may be installed/removed independently.
// Synthetic lessons use no external audio, no LLM and no automatic background capture.
export async function practice(api,skills,progress=()=>{},cancelled=()=>false){
 // Preflight every dependency before the first irreversible learning write.
 const required={
  articulation:['preview','observe'],memory:['remember'],
  motor:['propose','feedback','status'],sequence:['teach'],
  gesture:['plan'],wave:['render'],audiometry:['compare'],
  transition:['propose','feedback','status']
 };
 if(cancelled())throw Error('practice_cancelled');
 for(const [domain,actions] of Object.entries(required))
  for(const action of actions)
   if(typeof skills?.[domain]?.[action]!=='string')
    throw Error('missing_capability_'+domain+'_'+action);
 const call=async(domain,action,params={})=>{
  if(cancelled())throw Error('practice_cancelled');
  const id=skills[domain]?.[action];
  if(typeof id!=='string')throw Error('missing_capability_'+domain+'_'+action);
  return await api.call(id,params);
 };
 const loss=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==10||b.length!==10||
   ![...a,...b].every(v=>Number.isFinite(v)&&v>=0&&v<=1))
   throw Error('invalid_acoustic_features');
  return a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length;
 };
 const stimuli=[{f1:810,f2:1290},{f1:300,f2:2450}],identifiers=[];
 let lastFeedback=null;
 for(let i=0;i<stimuli.length;i++){
  progress('Слуховой образ '+(i+1)+' из '+stimuli.length);
  const teacher=await call('articulation','preview',{motor:stimuli[i]});
  const heard=await call('memory','remember',{samples:teacher.samples,
   sampleRate:12000,sourceApproved:true});
  identifiers.push(heard.id);
  const target=(await call('articulation','observe',{
   samples:teacher.samples,sampleRate:12000})).vector;
  for(let j=0;j<8;j++){
   const proposed=await call('motor','propose',{id:heard.id});
   if(!proposed.ready)break;
   const attempt=await call('articulation','preview',{motor:proposed.candidate});
   const vector=(await call('articulation','observe',{
    samples:attempt.samples,sampleRate:12000})).vector;
   lastFeedback=await call('motor','feedback',{id:heard.id,
    trial:proposed.trial,candidate:proposed.candidate,
    loss:loss(target,vector),sourceApproved:true});
   progress('Артикуляция '+(i+1)+'/2: попытка '+(j+1)+'/8');
  }
 }
 if(identifiers[0]===identifiers[1])throw Error('distinct_sound_motifs_required');
 progress('Запоминаю порядок услышанных образов');
 await call('sequence','teach',{events:identifiers.map((id,i)=>({
  id,gapMs:i?280:0})),sourceApproved:true});
 const motor=await call('motor','status');
 const records=identifiers.map(id=>motor.records.find(x=>x.id===id));
 if(records.some(x=>!x?.best||!Number.isFinite(x.loss)))
  throw Error('motor_memory_not_ready');
 const steps=records.map(x=>({motor:x.best,durationMs:240,pauseMs:0}));
 const referencePlan=await call('gesture','plan',{steps,transitionMs:120});
 const reference=await call('wave','render',{trajectory:referencePlan});
 let transitionResult=null;
 for(let j=0;j<7;j++){
  const proposed=await call('transition','propose',{
   from:identifiers[0],to:identifiers[1]});
  if(!proposed.ready)break;
  const plan=await call('gesture','plan',{steps,
   transitionMs:proposed.transitionMs});
  const attempt=await call('wave','render',{trajectory:plan});
  const evaluation=await call('audiometry','compare',{
   reference:reference.audioBase64,candidate:attempt.audioBase64});
  transitionResult=await call('transition','feedback',{
   from:proposed.from,to:proposed.to,trials:proposed.trials,
   transitionMs:proposed.transitionMs,loss:evaluation.loss,sourceApproved:true});
  progress('Переход между звуками: попытка '+(j+1)+'/7');
 }
 const status=await call('transition','status');
 const best=status.pairs.find(p=>p.from===identifiers[0]&&p.to===identifiers[1]);
 if(!best||!Number.isInteger(best.bestMs))throw Error('transition_memory_not_ready');
 const resultPlan=await call('gesture','plan',{steps,transitionMs:best.bestMs});
 const voice=await call('wave','render',{trajectory:resultPlan});
 progress('Цикл завершён — навыки и память сохранены');
 return {schema:'mikoshi.learning.loop.v1',motifs:identifiers,
  articulation:lastFeedback?.best||null,transitionMs:best.bestMs,
  transitionLoss:best.bestLoss,practiced:transitionResult?.trials||0,
  audioBase64:voice.audioBase64,mime:voice.mime,languageModel:false};
}

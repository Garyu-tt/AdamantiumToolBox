// Explicitly started local experiment; all skills resolved from a live graph.
export async function explore(api,skills,lesson,budget,progress=()=>{},cancel=()=>false){
 const required={explorer:['begin','choose','feedback','stop','status'],
  articulation:['observe','preview'],motor:['propose','feedback','status']};
 for(const [role,actions] of Object.entries(required))
  for(const action of actions)
   if(typeof skills?.[role]?.[action]!=='string')
    throw Error('missing_capability_'+role+'_'+action);
 if(!Array.isArray(lesson)||lesson.length<2||lesson.length>6||
  !Number.isInteger(budget)||budget<2||budget>12||
  new Set(lesson.map(e=>e.id)).size!==lesson.length||
  !lesson.every(e=>e&&/^m[0-9]{5,7}$/.test(e.id)&&
   Array.isArray(e.samples)&&e.samples.length===2400&&
   e.samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=1)))
  throw Error('invalid_exploration_lesson');
 if(cancel())throw Error('exploration_cancelled');
 const call=(role,action,params={})=>api.call(skills[role][action],params);
 const targets=new Map(lesson.map(e=>[e.id,e.samples]));
 const mse=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==10||b.length!==10||
   ![...a,...b].every(v=>Number.isFinite(v)&&v>=0&&v<=1))
   throw Error('invalid_acoustic_feedback');
  return Math.min(1,a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/10);
 };
 const started=await call('explorer','begin',{ids:lesson.map(e=>e.id),budget,
  sourceApproved:true});
 const sessionId=started.session.id,decisions=[];
 for(let i=0;i<budget;i++){
  if(cancel()){
   await call('explorer','stop',{sessionId,sourceApproved:true});
   return {schema:'mikoshi.exploration.result.v1',status:'stopped',decisions,
    languageModel:false};
  }
  const choice=await call('explorer','choose');
  if(!choice.ready)break;
  if(choice.sessionId!==sessionId||choice.step!==i||!targets.has(choice.id))
   throw Error('exploration_state_changed');
  const sample=targets.get(choice.id);
  const observed=(await call('articulation','observe',{
   samples:sample,sampleRate:12000})).vector;
  const proposal=await call('motor','propose',{id:choice.id});
  const motor=proposal.ready?proposal.candidate:(await call('motor','status'))
   .records.find(r=>r.id===choice.id)?.best;
  if(!motor)throw Error('motor_skill_not_available');
  const output=await call('articulation','preview',{motor});
  const voiced=(await call('articulation','observe',{
   samples:output.samples,sampleRate:12000})).vector;
  const loss=mse(observed,voiced);
  if(choice.action==='practice'){
   if(!proposal.ready)throw Error('motor_training_exhausted');
   await call('motor','feedback',{id:choice.id,trial:proposal.trial,
    candidate:proposal.candidate,loss,sourceApproved:true});
  }else if(choice.action!=='inspect')throw Error('unknown_exploration_action');
  const result=await call('explorer','feedback',{sessionId,step:choice.step,
   id:choice.id,action:choice.action,loss,sourceApproved:true});
  decisions.push({id:choice.id,action:choice.action,
   loss,improvement:result.progress});
  progress('Шаг '+(i+1)+'/'+budget+' · '+choice.action+
   ' · '+choice.id+' · ошибка '+loss.toFixed(4));
  if(result.status==='complete')break;
 }
 const state=await call('explorer','status');
 return {schema:'mikoshi.exploration.result.v1',status:state.session.status,
  decisions,summary:state.session.skills,languageModel:false};
}

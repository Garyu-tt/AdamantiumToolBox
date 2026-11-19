// Live capability-only sensory-motor practice, explicitly invoked by user.
export async function imitateEvents(api,skills,items,progress=()=>{}){
 const required={articulation:['observe','preview'],
  motor:['propose','feedback','status'],gesture:['plan'],wave:['render']};
 for(const [domain,actions] of Object.entries(required))
  for(const action of actions)
   if(typeof skills?.[domain]?.[action]!=='string')
    throw Error('missing_capability_'+domain+'_'+action);
 if(!Array.isArray(items)||items.length<2||items.length>6||
  !items.every((item,i)=>item&&/^m[0-9]{5,7}$/.test(item.id)&&
   Array.isArray(item.samples)&&item.samples.length===2400&&
   item.samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=1)&&
   Number.isInteger(item.durationMs)&&item.durationMs>=200&&
   item.durationMs<=1200&&Number.isInteger(item.gapMs)&&
   item.gapMs>=0&&item.gapMs<=5000&&(i>0||item.gapMs===0)))
  throw Error('invalid_stream_lesson');
 const call=(domain,action,params={})=>api.call(skills[domain][action],params);
 const error=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==10||b.length!==10||
   ![...a,...b].every(v=>Number.isFinite(v)&&v>=0&&v<=1))
   throw Error('invalid_auditory_feedback');
  return a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/10;
 };
 for(let n=0;n<items.length;n++){
  const event=items[n];
  const heard=(await call('articulation','observe',{
   samples:event.samples,sampleRate:12000})).vector;
  for(let trial=0;trial<6;trial++){
   const p=await call('motor','propose',{id:event.id});
   if(!p.ready)break;
   const voiced=await call('articulation','preview',{motor:p.candidate});
   const acoustic=(await call('articulation','observe',{
    samples:voiced.samples,sampleRate:12000})).vector;
   await call('motor','feedback',{id:event.id,candidate:p.candidate,
    trial:p.trial,loss:error(heard,acoustic),sourceApproved:true});
   progress('Слух → моторика: звук '+(n+1)+', попытка '+(trial+1));
  }
 }
 const memory=await call('motor','status');
 const byId=new Map(memory.records.map(record=>[record.id,record]));
 const steps=items.map((event,i)=>{
  const best=byId.get(event.id);
  if(!best?.best||!Number.isFinite(best.loss))throw Error('motor_skill_missing');
  const durationMs=Math.min(600,Math.max(120,Math.round(event.durationMs/10)*10));
  const next=items[i+1];
  const silence=next?Math.max(0,next.gapMs-durationMs):0;
  return {motor:best.best,durationMs,
   pauseMs:Math.min(200,Math.round(silence/10)*10)};
 });
 const trajectory=await call('gesture','plan',{steps,transitionMs:80});
 const wave=await call('wave','render',{trajectory});
 return {schema:'mikoshi.stream.imitation.v1',audioBase64:wave.audioBase64,
  mime:wave.mime,events:items.length,
  motors:steps.map(step=>step.motor),durationMs:wave.durationMs,
  languageModel:false};
}

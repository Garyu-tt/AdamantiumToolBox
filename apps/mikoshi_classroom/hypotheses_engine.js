// Explicit operator-triggered active experiment, via discovered MAS skills.
export async function testHypothesis(api,skills,base,progress=()=>{}){
 const required={hypothesis:['generate','rank'],
  world:['estimate','forecast','observe','status','abort'],
  articulation:['preview','observe']};
 for(const [domain,names] of Object.entries(required))
  for(const name of names)
   if(typeof skills?.[domain]?.[name]!=='string')
    throw Error('missing_capability_'+domain+'_'+name);
 const call=(domain,action,params={})=>api.call(skills[domain][action],params);
 const candidates=await call('hypothesis','generate',{motor:base});
 if(!Array.isArray(candidates.candidates)||candidates.candidates.length>8)
  throw Error('invalid_hypothesis_generation');
 const ranked=[];
 for(const motor of candidates.candidates){
  const estimate=await call('world','estimate',{motor});
  ranked.push({motor,estimate});
 }
 const choice=await call('hypothesis','rank',{options:ranked});
 if(!choice.motor||!Number.isInteger(choice.motor.f1)||
  !Number.isInteger(choice.motor.f2))
  throw Error('invalid_hypothesis_choice');
 progress('Гипотеза: проверю звук при моторике '+
  choice.motor.f1+'/'+choice.motor.f2);
 // Irreversible write only after ALL capabilities are confirmed.
 const forecast=await call('world','forecast',{
  motor:choice.motor,sourceApproved:true});
 progress(forecast.ready?'Прогноз записан до действия':
  'Прогноза ещё нет — исследую незнакомое движение');
 const rendered=await call('articulation','preview',{motor:choice.motor});
 const heard=await call('articulation','observe',{
  samples:rendered.samples,sampleRate:12000});
 // If this write fails, leave its ticket pending for explicit readback/abort.
 const outcome=await call('world','observe',{
  ticket:forecast.ticket,vector:heard.vector,sourceApproved:true});
 progress(outcome.predicted?'Ошибка предсказания: '+outcome.loss:
  'Первый проверенный образец для нового движения');
 return {schema:'mikoshi.hypothesis.experiment.v1',motor:choice.motor,
  reason:choice.reason,informationScore:choice.informationScore,
  priorConfidence:choice.expectedConfidence,
  forecastAvailable:forecast.ready,observed:outcome.predicted,
  predictionError:outcome.loss,surprise:outcome.surprise,
  totalExperience:outcome.observations,
  mime:rendered.mime,audioBase64:rendered.audioBase64,languageModel:false};
}

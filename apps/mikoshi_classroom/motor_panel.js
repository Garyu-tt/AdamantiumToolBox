// Only an optional UI composer: no imports, cross-provider keys or fixed host URLs.
export function motorPanel(host,api,articulation,motorProvider,allowed,getReference){
 const learner=motorProvider?.skill?.actions,voice=articulation?.skill?.actions;
 if(!learner||!voice||!allowed.has(learner.propose)||
  !allowed.has(voice.preview)||!allowed.has(voice.observe))return ()=>{};
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h3','Слух → артикуляция');
 const state=add('pre','Сначала узнайте или запомните звук');
 const player=add('audio');player.controls=true;
 let selected=null,busy=false;
 const feedback=learner.feedback&&allowed.has(learner.feedback);
 const loss=(a,b)=>{
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length!==10||
   ![...a,...b].every(v=>Number.isFinite(v)&&v>=0&&v<=1.01))
   throw Error('invalid_spectral_feedback');
  return a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length;
 };
 const train=add('button','Подобрать артикуляцию (8 попыток)');
 train.disabled=!feedback;
 train.onclick=async()=>{
  if(busy)return;
  const id=selected,source=getReference();
  if(!id||!source){state.textContent='Сначала выберите и распознайте образец';return;}
  busy=true;train.disabled=true;
  try{
   const reference=(await api.call(voice.observe,{
    samples:source,sampleRate:12000})).vector;
   let result=null;
   for(let i=0;i<8;i++){
    const p=await api.call(learner.propose,{id});
    if(!p.ready)break;
    const audio=await api.call(voice.preview,{motor:p.candidate});
    const spectral=(await api.call(voice.observe,{
     samples:audio.samples,sampleRate:12000})).vector;
    result=await api.call(learner.feedback,{id,trial:p.trial,
     candidate:p.candidate,loss:loss(reference,spectral),sourceApproved:true});
    state.textContent='Звук '+id+' · проба '+(i+1)+' / 8 · ошибка '+
     result.bestLoss.toFixed(5);
   }
   if(result)state.textContent='Звук '+id+' · лучшая ошибка '+
    result.bestLoss.toFixed(5)+' · шагов '+result.trials+
    ' · моторика '+JSON.stringify(result.best);
   else state.textContent='Курс для '+id+' завершён';
  }catch(e){state.textContent=String(e.message);}
  finally{busy=false;train.disabled=!feedback;}
 };
 const replay=add('button','Произнести выученный звук');
 replay.onclick=async()=>{
  if(!selected){state.textContent='Сначала выберите звуковой образ';return;}
  try{
   const response=await api.call(learner.status);
   const record=response.records.find(r=>r.id===selected);
   if(!record){state.textContent='Для этого звука пока нет артикуляции';return;}
   const voiceResult=await api.call(voice.preview,{motor:record.best});
   player.src='data:'+voiceResult.mime+';base64,'+voiceResult.audioBase64;
   state.textContent='Воспроизвожу моторный навык '+selected;
  }catch(e){state.textContent=String(e.message);}
 };
 return id=>{
  if(typeof id!=='string'||!/^m[0-9]{5,7}$/.test(id))return;
  selected=id;state.textContent='Выбран слуховой образ '+id;
 };
}

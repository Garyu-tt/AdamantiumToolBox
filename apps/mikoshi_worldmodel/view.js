export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Auditory World Predictor');
 add('p','Predict formant motor outcomes from remembered observations. No LLM.');
 const out=add('pre','');
 const button=add('button','Inspect predictions');
 button.onclick=async()=>{
  try{
   const s=await api.call('mikoshi_worldmodel.status');
   const p=await api.call('mikoshi_worldmodel.estimate',{
    motor:{f1:630,f2:1830}});
   out.textContent=JSON.stringify({status:s,estimate:p},null,2);
  }catch(e){out.textContent=String(e.message);}
 };
 const mayAbort=api.graph().nodes.some(n=>n.id==='mikoshi_worldmodel.abort');
 if(mayAbort){
  const recovery=add('button','Отменить зависший прогноз');
  recovery.onclick=async()=>{
   try{
    const state=await api.call('mikoshi_worldmodel.status');
    if(!state.pendingTicket){out.textContent='Незавершённых прогнозов нет';return;}
    await api.call('mikoshi_worldmodel.abort',{
     ticket:state.pendingTicket,sourceApproved:true});
    out.textContent='Только незавершённый прогноз отменён. Обученная память сохранена.';
   }catch(e){out.textContent=String(e.message);}
  };
 }
 await button.onclick();
}

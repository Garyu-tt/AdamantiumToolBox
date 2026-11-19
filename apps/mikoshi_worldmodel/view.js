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
 await button.onclick();
}

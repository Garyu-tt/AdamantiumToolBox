export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Vocal Gestures');
 add('p','Coarticulation planner. Two toy vowel-like motors, no words or LLM.');
 const info=add('pre','');
 const active=api.graph().nodes.some(n=>n.id==='mikoshi_gestures.plan');
 if(!active){info.textContent='Planner capability unavailable';return;}
 const button=add('button','Построить траекторию');
 button.onclick=async()=>{
  try{
   const value=await api.call('mikoshi_gestures.plan',{steps:[
    {motor:{f1:810,f2:1290},durationMs:240,pauseMs:0},
    {motor:{f1:300,f2:2450},durationMs:260,pauseMs:0}]});
   info.textContent=JSON.stringify({durationMs:value.durationMs,frames:value.frames.length,
    first:value.frames[0],last:value.frames.at(-1)},null,2);
  }catch(e){info.textContent=String(e.message);}
 };
}

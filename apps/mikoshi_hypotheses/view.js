// This panel can propose tests, but never executes another MAS capability.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Hypothesis Lab');
 add('p','Tests hypotheses about new motor sounds; no LLM or speech lexicon.');
 const status=add('pre','');
 const b=add('button','Show possible motor questions');
 b.onclick=async()=>{
  try{
   const proposal=await api.call('mikoshi_hypotheses.generate',
    {motor:{f1:560,f2:1640}});
   status.textContent=JSON.stringify(proposal,null,2);
  }catch(e){status.textContent=String(e.message);}
 };
 const active=api.graph().nodes.some(n=>n.id==='mikoshi_hypotheses.generate');
 b.disabled=!active;
 if(!active)status.textContent='Hypothesis generation unavailable';
}

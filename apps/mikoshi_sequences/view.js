// Standalone catalog: no fixed dependency on any hearing or TTS provider.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Temporal Hearing');
 add('p','Order-sensitive short-sound statistics; no speech understanding or LLM.');
 const out=add('pre','');
 const reload=add('button','Temporal memory status');
 reload.onclick=async()=>{
  try{out.textContent=JSON.stringify(await api.call('mikoshi_sequences.status'),null,2);}
  catch(e){out.textContent=String(e.message);}
 };
 await reload.onclick();
}

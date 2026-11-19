export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Audiovisual Associations');
 add('p','Only temporal correlations; cannot infer words or causal meaning.');
 const info=add('pre','');
 const button=add('button','View numerical associations');
 button.onclick=async()=>{
  try{info.textContent=JSON.stringify(await api.call(
   'mikoshi_grounding.status'),null,2);}
  catch(e){info.textContent=String(e.message);}
 };
 await button.onclick();
}

// Standalone policy inspection, no host imports or implicit execution.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Experiment Explorer');
 add('p','Chooses bounded practice from observed acoustic error, not an LLM.');
 const out=add('pre','');
 const update=add('button','Inspect experiment policy');
 update.onclick=async()=>{
  try{
   const [s,p]=await Promise.all([
    api.call('mikoshi_explorer.status'),
    api.call('mikoshi_explorer.choose')]);
   out.textContent=JSON.stringify({status:s,next:p},null,2);
  }catch(e){out.textContent=String(e.message);}
 };
 await update.onclick();
}

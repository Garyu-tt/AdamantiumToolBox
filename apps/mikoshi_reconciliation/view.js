export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,value)=>{const e=document.createElement(tag);
  if(value!==undefined)e.textContent=value;host.append(e);return e;};
 add('h2','Mikoshi Reconciliation');
 add('p','Read-only classification of interrupted, signed cross-provider writes.');
 const output=add('pre','');
 const button=add('button','Inspect recovery contract');
 button.onclick=async()=>{
  try{output.textContent=JSON.stringify(
   await api.call('mikoshi_reconciliation.status'),null,2);}
  catch(e){output.textContent=String(e.message);}
 };
 await button.onclick();
}

export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,value)=>{const e=document.createElement(tag);
  if(value!==undefined)e.textContent=value;host.append(e);return e;};
 add('h2','Mikoshi Audiovisual Alignment');
 add('p','Conservative event matching: timestamps only, no recording.');
 const text=add('pre','');
 const button=add('button','Inspect alignment rules');
 button.onclick=async()=>{
  try{text.textContent=JSON.stringify(await api.call(
   'mikoshi_avsync.status'),null,2);}
  catch(e){text.textContent=String(e.message);}
 };
 await button.onclick();
}

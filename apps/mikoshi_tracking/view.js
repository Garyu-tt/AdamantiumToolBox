export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Coarse Visual Tracking');
 add('p','Anonymous 8×8 foreground regions; no identity or object labels.');
 const out=add('pre','');
 const b=add('button','Inspect tracker');
 b.onclick=async()=>{
  try{out.textContent=JSON.stringify(await api.call('mikoshi_tracking.status'));}
  catch(e){out.textContent=String(e.message);}
 };
 await b.onclick();
}

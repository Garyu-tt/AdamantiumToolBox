export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Sensor Source Policy');
 add('p','Operator assertions are NOT independent legal consent verification.');
 const out=add('pre','');
 const b=add('button','Inspect source gate');
 b.onclick=async()=>{
  try{out.textContent=JSON.stringify(await api.call('mikoshi_sourcepolicy.status'));}
  catch(e){out.textContent=String(e.message);}
 };
 await b.onclick();
}

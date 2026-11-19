export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Clock Calibration Lab');
 add('p','Needs independently known AV cues. Arbitrary coincidence is insufficient.');
 const out=add('pre','');
 const b=add('button','Inspect calibration capability');
 b.onclick=async()=>{
  try{out.textContent=JSON.stringify(await api.call('mikoshi_clockcal.status'));}
  catch(e){out.textContent=String(e.message);}
 };
 await b.onclick();
}

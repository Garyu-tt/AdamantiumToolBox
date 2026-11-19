export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);e.textContent=t||'';host.append(e);return e;};
 add('h2','Mikoshi Learning — no language model');
 const info=add('pre','');
 const reload=add('button','Refresh progress');
 reload.onclick=async()=>{try{info.textContent=JSON.stringify(
  await api.call('mikoshi_learning.status'),null,2);}
 catch(e){info.textContent=String(e.message);}};
 add('p','Online learning needs observed, labelled examples and correctness feedback.');
 await reload.onclick();
}

// The independent controller never controls a particular synthesizer directly.
export async function mount(host,api){
 host.replaceChildren();
 const h=document.createElement('h2');h.textContent='Mikoshi Vocal Motor Links';host.append(h);
 const info=document.createElement('pre');host.append(info);
 const reload=document.createElement('button');reload.textContent='Motor learning status';
 host.append(reload);
 reload.onclick=async()=>{
  try{info.textContent=JSON.stringify(await api.call('mikoshi_motorlinks.status'),null,2);}
  catch(e){info.textContent=String(e.message);}
 };
 await reload.onclick();
}

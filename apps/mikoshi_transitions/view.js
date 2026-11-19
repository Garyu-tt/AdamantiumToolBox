export async function mount(host,api){
 host.replaceChildren();
 const h=document.createElement('h2');h.textContent='Mikoshi Transition Learner';host.append(h);
 const pre=document.createElement('pre');host.append(pre);
 const b=document.createElement('button');b.textContent='Show learned joins';host.append(b);
 b.onclick=async()=>{try{pre.textContent=JSON.stringify(
  await api.call('mikoshi_transitions.status'),null,2);}
 catch(e){pre.textContent=String(e.message);}};
 await b.onclick();
}

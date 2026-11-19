export async function mount(host,api){
 host.replaceChildren();
 const h=document.createElement('h2');h.textContent='Mikoshi Ear';host.append(h);
 const p=document.createElement('p');
 p.textContent='CPU-first PCM features. Audio capture and word recognition are separate.';
 host.append(p);
 const out=document.createElement('pre');out.textContent='No microphone is active.';host.append(out);
 const btn=document.createElement('button');btn.textContent='Test synthetic tone';host.append(btn);
 btn.onclick=async()=>{
  const samples=Array.from({length:800},(_,i)=>Math.sin(i*2*Math.PI*200/16000)*.35);
  try{const result=await api.call('mikoshi_hearing.analyze',{samples,sampleRate:16000});
   out.textContent=JSON.stringify(result,null,2);}
  catch(e){out.textContent=String(e.message);}
 };
}

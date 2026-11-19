export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);
  if(t!==undefined)e.textContent=t;host.append(e);return e;};
 add('h2','Mikoshi Auditory Segments');
 add('p','CPU acoustic event detection. No words, recordings or automatic training.');
 const out=add('pre','');
 const button=add('button','Проверить обнаружение двух сигналов');
 button.onclick=async()=>{
  const sound=(hz,n)=>Array.from({length:n},(_,i)=>Math.sin(
   2*Math.PI*hz*i/12000)*.35);
  const input=[...Array(2400).fill(0),...sound(280,2400),
   ...Array(1200).fill(0),...sound(710,2400),...Array(2400).fill(0)];
  try{
   const r=await api.call('mikoshi_segments.analyze',{samples:input,sampleRate:12000});
   out.textContent='События: '+r.detected+'; временные метки: '+
    r.events.map(e=>e.timeMs+' мс').join(', ');
  }catch(e){out.textContent=String(e.message);}
 };
}

export async function mount(host,api){
 host.replaceChildren();
 const h=document.createElement('h2');h.textContent='Mikoshi Acoustic Feedback';host.append(h);
 const p=document.createElement('p');
 p.textContent='Compare short aligned CPU-generated WAV exercises. No training or recording here.';
 host.append(p);
 const pre=document.createElement('pre');
 pre.textContent=api.graph().nodes.some(x=>x.id==='mikoshi_audiometry.compare')?
  'Acoustic feedback is available to the composite curriculum.':
  'Acoustic feedback capability is unavailable.';
 host.append(pre);
}

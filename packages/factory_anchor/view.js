// Factory Anchor R09: raw, bounded, read-only MAS view.
export async function mount(host,api){
 const title=document.createElement('h2');
 title.textContent='Factory Anchor · MAS R09';
 host.append(title);
 const detail=document.createElement('pre');
 detail.textContent='Inspecting separate audit witness…';
 host.append(detail);
 try{
  const status=await api.call('factory_anchor.status',{});
  detail.textContent=JSON.stringify(status,null,2);
 }catch{
  detail.textContent='Factory Anchor not installed, not connected or not authorized. No production actions were executed.';
 }
 const note=document.createElement('p');
 note.textContent='Audit signature is not a Lifecycle approval or permission to install a module.';
 host.append(note);
}

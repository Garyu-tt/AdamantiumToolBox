export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='WireGuard · peer enrollment';host.append(title);
 const status=document.createElement('p');host.append(status);
 const form=document.createElement('section');host.append(form);
 const hint=document.createElement('p');hint.textContent='Preview only; two independent approvals required for any network change.';form.append(hint);
 const op=document.createElement('select');
 for(const name of ['add','remove']){const o=document.createElement('option');o.value=name;o.textContent=name;op.append(o)}
 form.append(op);
 const pk=document.createElement('input');pk.placeholder='WireGuard client public key (base64)';pk.autocomplete='off';form.append(pk);
 const address=document.createElement('input');address.placeholder='Peer IPv4/32';address.autocomplete='off';form.append(address);
 const result=document.createElement('pre');host.append(result);
 const refresh=document.createElement('button');refresh.textContent='Refresh status';
 const prepare=document.createElement('button');prepare.textContent='Prepare approval plan';
 const profile=document.createElement('button');profile.textContent='Client config (enrolled only)';
 host.append(refresh,prepare,profile);
 async function report(){try{
  const s=await api.call('network_wireguard_peer.status',{});
  status.textContent='Configured: '+String(s.configured)+' · peers: '+String(s.peerCount??'unavailable')+
   ' · write enabled: '+String(s.applyEnabled)+' · profile ready: '+String(s.profileReady)+' · persistent: false';
  profile.disabled=!s.profileReady;
 }catch{status.textContent='No authorized peer capability available'}}
 refresh.addEventListener('click',report);
 prepare.addEventListener('click',async()=>{
  try{
   const s=await api.call('network_wireguard_peer.prepare',{
    operation:op.value,peerPublicKey:pk.value.trim(),allowedIP:address.value.trim()});
   result.textContent=JSON.stringify(s,null,2);
  }catch{result.textContent='Preview unavailable or invalid peer request'}
 });
 profile.addEventListener('click',async()=>{
  try{
   const s=await api.call('network_wireguard_peer.clientProfile',{
    peerPublicKey:pk.value.trim(),address:address.value.trim()});
   result.textContent=s.template+'\nLOCAL PRIVATE KEY IS NOT INCLUDED. Never enter it in the web UI.';
  }catch{result.textContent='Client profile unavailable; verify enrollment and pinned server settings'}
 });
 await report();
}

export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='WireGuard · read-only';host.append(title);
 const status=document.createElement('p');host.append(status);
 const list=document.createElement('div');host.append(list);
 async function refresh(){
  list.replaceChildren();
  try{
   const s=await api.call('network_wireguard.status',{});
   status.textContent=s.available?`Active interfaces: ${s.interfaceCount}, peers: ${s.peerCount}`:
    `WireGuard unavailable: ${s.reason||'unknown'}`;
   if(!s.available)return;
   const p=await api.call('network_wireguard.peers',{});
   for(const iface of p.interfaces){
    const item=document.createElement('section'),name=document.createElement('h3');
    name.textContent=iface.id+' · peers '+iface.peerCount;item.append(name);
    const ul=document.createElement('ul');for(const peer of iface.peers){const li=document.createElement('li');
     li.textContent=peer.id+' · allowed routes '+peer.allowedIPs.join(', ')+' · bytes ↑'+peer.transferTxBytes+' ↓'+peer.transferRxBytes;ul.append(li);}
    item.append(ul);list.append(item);
   }
  }catch{status.textContent='No authorized WireGuard capability available';}
 }
 const button=document.createElement('button');button.textContent='Refresh';button.addEventListener('click',refresh);host.append(button);
 await refresh();
}

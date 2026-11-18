export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='Network Policy Manager';host.append(title);
 const info=document.createElement('pre');info.textContent='Read-only signed approval inspection';host.append(info);
 try{const s=await api.call('network_policy.status',{});info.textContent=JSON.stringify(s,null,2);}catch{info.textContent='Capability unavailable';}
}

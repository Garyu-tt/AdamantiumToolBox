export async function mount(host,api){const title=document.createElement('h2');title.textContent='Network Checkpoint Transport';host.append(title);
 const info=document.createElement('pre');host.append(info);
 try{const data=await api.call('network_checkpoint.status',{});info.textContent=JSON.stringify(data,null,2)}
 catch{info.textContent='Transport status unavailable';}}

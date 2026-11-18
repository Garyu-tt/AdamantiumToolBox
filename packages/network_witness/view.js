export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='Network Audit Witness';host.append(title);
 const info=document.createElement('pre');info.textContent='Reading verified witness state…';host.append(info);
 try{const r=await api.call('network_witness.status',{});
  info.textContent=JSON.stringify(r,null,2);
 }catch{info.textContent='Witness unavailable or not authorized. No network permissions granted.';}
}

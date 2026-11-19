export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='Independent Audit Anchor';host.append(title);
 const info=document.createElement('pre');info.textContent='Checking signed audit anchor…';host.append(info);
 try{const status=await api.call('network_anchor.status',{});info.textContent=JSON.stringify(status,null,2)}
 catch{info.textContent='Audit Anchor unavailable or not authorized. No network access was granted.';}
}

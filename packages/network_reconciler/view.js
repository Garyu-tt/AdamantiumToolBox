export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='Network Reconciler';host.append(title);
 const info=document.createElement('pre');info.textContent='Plan/rollback preview only — no network mutations';host.append(info);
 try{info.textContent=JSON.stringify(await api.call('network_reconciler.status',{}),null,2);}catch{info.textContent='Capability unavailable';}
}

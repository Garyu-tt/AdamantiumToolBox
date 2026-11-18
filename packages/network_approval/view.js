export async function mount(host,api){
 const title=document.createElement('h2');title.textContent='Network Approval Ledger';host.append(title);
 const info=document.createElement('p');info.textContent='Read-only inspection. Signed changes require a separate signer and explicit permissions.';host.append(info);
 const output=document.createElement('pre');host.append(output);
 try{const s=await api.call('network_approval.list',{});
  output.textContent=JSON.stringify(s,null,2);
 }catch{output.textContent='Approval ledger is unavailable or not authorized.';}
}

export async function mount(host,api){
 const h=document.createElement('h2');h.textContent='Adamantium MCP Bridge';host.append(h);
 const p=document.createElement('p');host.append(p);
 try{const s=await api.call('mcp_bridge.status',{});p.textContent=s.status==='ready'?'MCP bridge is ready on local loopback.':'Bridge status unavailable.';}
 catch{p.textContent='Bridge status cannot be read from the current capability graph.';}
}

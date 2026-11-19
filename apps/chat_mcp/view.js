export async function mount(host,api){
 const h=document.createElement('h3');h.textContent='MCP и инструменты';host.append(h);
 const box=document.createElement('div');host.append(box);
 const render=()=>{
  box.replaceChildren();const nodes=api.graph().nodes.filter(n=>n.type==='resource'&&n.mcp?.schema==='mas-mcp-provider-1');
  if(!nodes.length){box.textContent='Сейчас нет доступных MCP-провайдеров';return;}
  for(const node of nodes){const row=document.createElement('p');row.textContent=node.mcp.title||node.id;box.append(row);}
 };
 render();
}

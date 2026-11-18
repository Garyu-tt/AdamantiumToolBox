export async function mount(host,api){
 const add=(tag,text)=>{const x=document.createElement(tag);
  if(text!==undefined)x.textContent=text;host.append(x);return x;};
 add('h2','WireGuard Graph');
 add('p','Публичные отпечатки пиров и AllowedIPs. Приватные ключи не запрашиваются.');
 const button=add('button','Проверить локальные WireGuard-пиры');
 const result=add('pre');result.style.whiteSpace='pre-wrap';
 result.style.overflowWrap='anywhere';
 button.disabled=!api.graph().nodes.some(x=>x.id==='wireguard_graph.snapshot');
 button.onclick=async()=>{try{
  const data=await api.call('wireguard_graph.snapshot',{});
  result.textContent=JSON.stringify(data,null,2);
 }catch(e){result.textContent='Ошибка: '+e.message;}};
}

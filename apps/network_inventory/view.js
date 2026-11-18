export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','Network Inventory');
 add('p','Локальный снимок интерфейсов и маршрутов. IP не доказывает идентичность узла.');
 const button=add('button','Снять локальный снимок');
 const output=add('pre');output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 button.disabled=!api.graph().nodes.some(x=>x.id==='network_inventory.snapshot');
 button.onclick=async()=>{try{
  const result=await api.call('network_inventory.snapshot',{});
  output.textContent=JSON.stringify(result,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
}

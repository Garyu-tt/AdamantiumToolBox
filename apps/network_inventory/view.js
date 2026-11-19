export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','Network Inventory');
 add('p','Локальный снимок интерфейсов/маршрутов. IP не подтверждает идентичность узла.');
 const output=add('pre');output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 const snapshot=add('button','Снять локальный снимок');
 snapshot.disabled=!api.graph().nodes.some(x=>x.id==='network_inventory.snapshot');
 snapshot.onclick=async()=>{try{
  const result=await api.call('network_inventory.snapshot',{});
  output.textContent=JSON.stringify(result,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
 add('h3','Сверить привязки сервисов');
 const input=add('textarea');input.rows=10;input.style.width='100%';
 input.placeholder='{"targetNode":"server","topology":{"nodes":[],"services":[]}}';
 const verify=add('button','Сравнить с локальной сетью');
 verify.disabled=!api.graph().nodes.some(x=>x.id==='network_inventory.reconcile');
 verify.onclick=async()=>{try{
  const result=await api.call('network_inventory.reconcile',JSON.parse(input.value));
  output.textContent=JSON.stringify(result,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
}

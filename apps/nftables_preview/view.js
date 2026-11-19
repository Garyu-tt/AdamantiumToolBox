export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','nftables Preview');
 add('p','Кандидаты и граф транзакции: без применения к ядру, без изменения маршрутов.');
 const input=add('textarea');input.rows=12;input.style.width='100%';
 input.placeholder='{"targetNode":"host","topology":{"nodes":[],"services":[],"rules":[]},"managementFlows":[]}';
 const output=add('pre');output.style.whiteSpace='pre-wrap';
 output.style.overflowWrap='anywhere';
 for(const [action,label] of [['nftables_preview.compile','Составить правила'],
  ['nftables_preview.transaction','Проверить этапы транзакции']]){
  const button=add('button',label);
  button.disabled=!api.graph().nodes.some(x=>x.id===action);
  button.onclick=async()=>{try{
   const result=await api.call(action,JSON.parse(input.value));
   output.textContent=JSON.stringify(result,null,2);
  }catch(e){output.textContent='Ошибка: '+e.message;}};
 }
}

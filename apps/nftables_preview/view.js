export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','nftables Preview');
 add('p','Только логические кандидаты. Нет применения, доступа к ядру или проверки маршрутов.');
 const text=add('textarea');text.rows=12;text.style.width='100%';
 text.placeholder='{"targetNode":"host","topology":{"nodes":[],"services":[],"rules":[]}}';
 const run=add('button','Составить предварительный план');
 const output=add('pre');output.style.whiteSpace='pre-wrap';
 run.disabled=!api.graph().nodes.some(x=>x.id==='nftables_preview.compile');
 run.onclick=async()=>{try{const result=await api.call('nftables_preview.compile',JSON.parse(text.value));
  output.textContent=JSON.stringify(result,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
}

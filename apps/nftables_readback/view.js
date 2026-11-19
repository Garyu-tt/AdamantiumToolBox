export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','nftables Readback');
 add('p','Только чтение правил из операторского изолированного namespace.');
 const button=add('button','Считать хеш и состав правил');
 const result=add('pre');result.style.whiteSpace='pre-wrap';
 result.style.overflowWrap='anywhere';
 button.disabled=!api.graph().nodes.some(x=>x.id==='nftables_readback.observe');
 button.onclick=async()=>{try{
  const value=await api.call('nftables_readback.observe',{});
  result.textContent=JSON.stringify(value,null,2);
 }catch(e){result.textContent='Ошибка: '+e.message;}};
}

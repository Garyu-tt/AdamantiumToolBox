export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const x=document.createElement(tag);
  if(text!==undefined)x.textContent=text;parent.append(x);return x;};
 add('h2','Graph DNS · проектирование');
 add('p','Снимок зон и привязок → диагностика → план. Публикации в DNS нет.');
 const data=add('textarea');data.rows=10;data.style.width='100%';
 data.placeholder='{"zones":[],"records":[],"bindings":[]}';
 const trigger=add('button','Проверить DNS-граф'),output=add('pre','');
 output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 trigger.onclick=async()=>{try{const params=JSON.parse(data.value);
  output.textContent=JSON.stringify(await api.call('graph_dns.audit',params),null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
 if(!api.graph().nodes.some(n=>n.id==='graph_dns.audit'))trigger.disabled=true;
}

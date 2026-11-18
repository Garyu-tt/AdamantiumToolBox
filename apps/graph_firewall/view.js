export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h2','Graph Firewall');
 add('p','Политики связей между узлами и сервисами. Только аудит/симуляция, без изменения системы.');
 const data=add('textarea');data.rows=13;data.style.width='100%';
 data.placeholder=JSON.stringify({nodes:[],services:[],rules:[]},null,2);
 const button=add('button','Проверить граф'),output=add('pre');
 output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 button.disabled=!api.graph().nodes.some(x=>x.id==='graph_firewall.inspect');
 button.onclick=async()=>{try{
  const result=await api.call('graph_firewall.inspect',JSON.parse(data.value));
  output.textContent=JSON.stringify(result,null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
}

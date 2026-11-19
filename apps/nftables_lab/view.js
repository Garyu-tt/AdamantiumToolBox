export async function mount(host,api){
 const add=(tag,text)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;host.append(el);return el;};
 add('h2','nftables Lab');
 add('p','Только проверка синтаксиса в заранее созданном отдельном Linux netns.');
 const input=add('textarea');input.rows=12;input.style.width='100%';
 input.placeholder='Вставьте JSON из nftables_preview.compile';
 const button=add('button','Проверить в изолированном пространстве');
 const result=add('pre');result.style.whiteSpace='pre-wrap';
 result.style.overflowWrap='anywhere';
 button.disabled=!api.graph().nodes.some(n=>n.id==='nftables_lab.check');
 button.onclick=async()=>{try{
  const value=await api.call('nftables_lab.check',{preview:JSON.parse(input.value)});
  result.textContent=JSON.stringify(value,null,2);
 }catch(e){result.textContent='Ошибка: '+e.message;}};
}

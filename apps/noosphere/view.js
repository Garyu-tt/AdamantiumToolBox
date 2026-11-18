export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const x=document.createElement(tag);
  if(text!==undefined)x.textContent=text;parent.append(x);return x;};
 add('h2','Noosphere 3.0 · контролируемая миграция');
 add('p','Проверка экспортированных записей без записи в исходную или новую базу.');
 const data=add('textarea');data.rows=10;data.style.width='100%';
 data.placeholder='{"records":[]}';
 const trigger=add('button','Проверить партию'),output=add('pre','');
 output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 trigger.onclick=async()=>{try{
  output.textContent=JSON.stringify(await api.call('noosphere.inspect',JSON.parse(data.value)),null,2);
 }catch(e){output.textContent='Ошибка: '+e.message;}};
 if(!api.graph().nodes.some(n=>n.id==='noosphere.inspect'))trigger.disabled=true;
}

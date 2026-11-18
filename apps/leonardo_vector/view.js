export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 add('h2','Leonardo Vector CPU');
 add('p','Геометрические SVG и процедурная графика без GPU и внешнего сервиса.');
 const prompt=add('textarea');prompt.rows=3;prompt.placeholder='Название изображения или описание';
 const button=add('button','Создать SVG');
 const message=add('p','');const image=add('img');
 image.alt='Предпросмотр';image.style.maxWidth='100%';image.hidden=true;
 button.disabled=!api.graph().nodes.some(n=>n.id==='leonardo_vector.generate');
 button.onclick=async()=>{
  button.disabled=true;message.textContent='Генерация…';image.hidden=true;
  try{
   const result=await api.call('leonardo_vector.generate',{
    kind:'image',format:'image/svg+xml',prompt:prompt.value,options:{width:512,height:320}});
   if(result.status!=='completed'||result.artifact?.mime!=='image/svg+xml')throw Error('bad_result');
   image.src='data:image/svg+xml;base64,'+result.artifact.data;
   image.hidden=false;message.textContent='Готово · локальная SVG-графика';
  }catch(e){message.textContent=e.message;}
  finally{button.disabled=false;}
 };
}

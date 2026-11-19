// Optional classroom widget: one live skill resource, zero provider imports.
export function phoneticPanel(host,api,resource,allowed){
 const a=resource?.skill?.actions;
 if(!a||!allowed.has(a.preview))return;
 const add=(tag,text,where=host)=>{const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;where.append(el);return el;};
 add('h3','Учимся повторять звуки');
 const choices=add('select');
 for(const [name,f1,f2] of [['А',810,1290],['И',300,2450],['У',420,1030]]){
  const o=add('option',name,choices);o.value=JSON.stringify({f1,f2});
 }
 const referenceAudio=add('audio');referenceAudio.controls=true;
 const ownAudio=add('audio');ownAudio.controls=true;
 const result=add('pre','Сначала послушайте образец');
 let teacher=null;
 const teacherButton=add('button','Слушать образец');
 teacherButton.onclick=async()=>{
  try{
   const r=await api.call(a.preview,{motor:JSON.parse(choices.value)});
   teacher=r.samples;
   referenceAudio.src='data:'+r.mime+';base64,'+r.audioBase64;
   result.textContent='Образец без записи с микрофона. Теперь можно повторить.';
  }catch(e){result.textContent=String(e.message);}
 };
 const myButton=add('button','Попытка Данте');
 myButton.onclick=async()=>{
  try{
   const r=await api.call(a.preview,{});
   ownAudio.src='data:'+r.mime+';base64,'+r.audioBase64;
   result.textContent='Моторика: '+JSON.stringify(r.motor);
  }catch(e){result.textContent=String(e.message);}
 };
 if(a.imitate&&allowed.has(a.imitate)){
  const train=add('button','Сравнить и обучить');
  train.onclick=async()=>{
   if(!teacher){result.textContent='Сначала послушайте учебный образец';return;}
   try{
    const r=await api.call(a.imitate,{samples:teacher,
     sampleRate:12000,sourceApproved:true});
    result.textContent='Спектральная ошибка: '+r.before.toFixed(5)+
     ' → '+r.after.toFixed(5)+' · уроков: '+r.lessons;
   }catch(e){result.textContent=String(e.message);}
  };
 }
}

// Optional auditory memory panel: source audio is never cached by this widget.
export function motifsPanel(host,api,provider,allowed,getReference){
 const actions=provider?.skill?.actions;
 if(!actions||!allowed.has(actions.recognize))return;
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h3','Слуховая память: узнаём звуки');
 const info=add('pre','Сначала выберите или запишите короткий звук');
 const params=()=>{
  const samples=getReference();
  if(!samples)throw Error('Сначала подготовьте образец звука');
  return {samples,sampleRate:12000};
 };
 const listen=add('button','Узнать услышанный звук');
 listen.onclick=async()=>{
  try{
   const v=await api.call(actions.recognize,params());
   info.textContent=v.matched?'Узнал знакомый образ '+v.id:
    'Пока не знаком. Ближайший образ: '+(v.nearestId||'нет');
  }catch(e){info.textContent=String(e.message);}
 };
 if(actions.remember&&allowed.has(actions.remember)){
  const remember=add('button','Запомнить услышанный звук');
  remember.onclick=async()=>{
   try{
    const v=await api.call(actions.remember,{...params(),sourceApproved:true});
    info.textContent=(v.kind==='discovered'?'Открыт новый звуковой образ: ':
     'Закрепил знакомый звуковой образ: ')+v.id+' · повторений: '+v.observations;
   }catch(e){info.textContent=String(e.message);}
  };
 }
 if(actions.status&&allowed.has(actions.status)){
  const status=add('button','Каталог освоенных образов');
  status.onclick=async()=>{
   try{info.textContent=JSON.stringify(await api.call(actions.status),null,2);}
   catch(e){info.textContent=String(e.message);}
  };
 }
}

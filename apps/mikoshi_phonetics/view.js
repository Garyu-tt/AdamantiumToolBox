// Bounded synthetic lesson: no microphone access or stored teacher audio.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,content)=>{const e=document.createElement(tag);
  if(content!==undefined)e.textContent=content;host.append(e);return e;};
 add('h2','Mikoshi Articulation Lab');
 add('p','Слушает образец, пробует звук, сравнивает спектр, корректирует артикуляцию.');
 const info=add('pre',''),audio=add('audio');audio.controls=true;
 const allowed=new Set(api.graph().nodes.filter(n=>n.type==='action').map(n=>n.id));
 const provider=api.graph().nodes.find(n=>n.skill?.domain==='articulation'&&
  n.skill.schema==='mikoshi.skill.v1');
 if(!provider){info.textContent='Нет разрешённого синтезатора';return;}
 const actions=provider.skill.actions;
 let reference=null;
 if(allowed.has(actions.preview)){
  const b=add('button','Послушать учебный звук');
  b.onclick=async()=>{
   try{
    const r=await api.call(actions.preview,{motor:{f1:810,f2:1290}});
    reference=r.samples;audio.src='data:'+r.mime+';base64,'+r.audioBase64;
    info.textContent='Образец создан. Можно повторить.';
   }catch(e){info.textContent=String(e.message);}
  };
  const attempt=add('button','Текущая попытка');
  attempt.onclick=async()=>{
   try{const r=await api.call(actions.preview,{});
    audio.src='data:'+r.mime+';base64,'+r.audioBase64;
    info.textContent='Артикуляция: '+JSON.stringify(r.motor);}
   catch(e){info.textContent=String(e.message);}
  };
 }
 if(actions.imitate&&allowed.has(actions.imitate)){
  const b=add('button','Сравнить и скорректировать');
  b.onclick=async()=>{
   if(!reference){info.textContent='Сначала создайте образец';return;}
   try{const r=await api.call(actions.imitate,
    {samples:reference,sampleRate:12000,sourceApproved:true});
    info.textContent='Ошибка до/после: '+r.before+' → '+r.after+
     '\nАртикуляция: '+JSON.stringify(r.motor);}
   catch(e){info.textContent=String(e.message);}
  };
 }
 const stat=add('button','Состояние обучения');
 stat.onclick=async()=>{
  try{info.textContent=JSON.stringify(await api.call('mikoshi_phonetics.status'),null,2);}
  catch(e){info.textContent=String(e.message);}
 };
 await stat.onclick();
}

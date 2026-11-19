export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,t)=>{const e=document.createElement(tag);e.textContent=t||'';host.append(e);return e;};
 add('h2','Piper Voice — independent optional acoustic engine');
 const info=add('pre','');
 const text=add('textarea');text.value='Привет, я учусь говорить!';text.maxLength=80;
 const btn=add('button','Синтезировать'),audio=add('audio');audio.controls=true;
 const live=api.graph().nodes.some(n=>n.id==='mikoshi_piper.speak');
 btn.hidden=!live;text.hidden=!live;audio.hidden=!live;
 btn.onclick=async()=>{
  try{const r=await api.call('mikoshi_piper.speak',{text:text.value});
   audio.src='data:'+r.mime+';base64,'+r.audioBase64;info.textContent=r.provider;}
  catch(e){info.textContent=String(e.message);}
 };
 try{info.textContent=JSON.stringify(await api.call('mikoshi_piper.status'),null,2);}
 catch(e){info.textContent=String(e.message);}
}

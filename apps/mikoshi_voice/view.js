export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text||'';host.append(e);return e;};
 add('h2','Mikoshi Voice');
 const input=add('textarea');input.value='Привет! Я учусь говорить.';input.maxLength=80;
 const btn=add('button','Произнести'),status=add('pre');
 const audio=add('audio');audio.controls=true;
 btn.onclick=async()=>{
  status.textContent='Generating locally…';
  try{
   const r=await api.call('mikoshi_voice.speak',{text:input.value});
   audio.src='data:'+r.mime+';base64,'+r.audioBase64;
   status.textContent='Voice: '+r.provider+'; no language model';
  }catch(e){status.textContent=String(e.message);}
 };
 try{const s=await api.call('mikoshi_voice.status');
  status.textContent='Engine: '+s.engine+'; profile: '+JSON.stringify(s.profile);}
 catch(e){status.textContent=String(e.message);}
}

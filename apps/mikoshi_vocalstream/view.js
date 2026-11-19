export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Vocal Stream');
 add('p','Independent phase-continuous vowel-like waveform renderer. No TTS language model.');
 const status=add('pre',''),field=add('textarea');
 field.value=JSON.stringify({schema:'mikoshi.gesture.frames.v1',frameMs:10,
  durationMs:240,segments:2,frames:Array.from({length:24},(_,i)=>({
   f1:i<12?810:300,f2:i<12?1290:2450,voiced:true}))});
 const ready=api.graph().nodes.some(n=>n.id==='mikoshi_vocalstream.render');
 field.hidden=!ready;
 if(ready){
  const button=add('button','Воспроизвести параметры');
  const audio=add('audio');audio.controls=true;
  button.onclick=async()=>{
   try{
    const wave=await api.call('mikoshi_vocalstream.render',{
     trajectory:JSON.parse(field.value)});
    audio.src='data:'+wave.mime+';base64,'+wave.audioBase64;
    status.textContent='Duration '+wave.durationMs+' ms';
   }catch(e){status.textContent=String(e.message);}
  };
 }
 try{status.textContent=JSON.stringify(await api.call('mikoshi_vocalstream.status'),null,2);}
 catch(e){status.textContent=String(e.message);}
}

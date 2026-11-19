export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;host.append(e);return e;};
 add('h2','Mikoshi Visual Event Encoder');
 add('p','Anonymous 8×8 RGB changes, no camera, object labels, or LLM.');
 const out=add('pre','');
 const button=add('button','Run a synthetic visual event test');
 button.onclick=async()=>{
  try{
   const blank=Array(192).fill(0),red=[...blank];
   for(let y=2;y<5;y++)for(let x=2;x<5;x++)red[(y*8+x)*3]=1;
   const frames=[{timeMs:0,pixels:blank},{timeMs:200,pixels:red}];
   const value=await api.call('mikoshi_vision.analyze',{frames});
   out.textContent=JSON.stringify({detected:value.detected,
    events:value.events},null,2);
  }catch(e){out.textContent=String(e.message);}
 };
}

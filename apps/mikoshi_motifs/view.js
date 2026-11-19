// Standalone view: only capabilities actually published by the host are shown.
export async function mount(host,api){
 host.replaceChildren();
 const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text||'';host.append(e);return e;};
 add('h2','Mikoshi Auditory Memory');
 add('p','Learns recurring acoustic motifs without spelling or language-model output.');
 const report=add('pre');
 const update=add('button','Refresh heard motifs');
 update.onclick=async()=>{
  try{const result=await api.call('mikoshi_motifs.status');
   report.textContent=JSON.stringify(result,null,2);
  }catch(e){report.textContent=String(e.message);}
 };
 await update.onclick();
}

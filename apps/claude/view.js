export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','Adamantium Claude');
 const enabled=api.graph().nodes.some(n=>n.id==='claude.start');
 add('p',enabled?'Claude provider available through MAS graph.':'Provider inactive: configure API endpoint, model and credentials in the host environment.');
 const prompt=add('textarea');prompt.placeholder='Claude task';prompt.rows=4;
 const run=add('button','Create job');run.disabled=!enabled;
 const refresh=add('button','Refresh jobs');
 const jobs=add('div'),out=add('pre','');
 async function reload(){jobs.replaceChildren();
  if(!api.graph().nodes.some(n=>n.id==='claude.jobs'))return;
  for(const j of await api.call('claude.jobs')){
   const line=add('div',j.jobId+' · '+j.status+' ',jobs),show=add('button','Details',line);
   show.onclick=async()=>{out.textContent=JSON.stringify(await api.call('claude.status',{jobId:j.jobId}),null,2);};
   if(['queued','running'].includes(j.status)&&api.graph().nodes.some(n=>n.id==='claude.cancel')){
    const cancel=add('button','Cancel',line);
    cancel.onclick=async()=>{await api.call('claude.cancel',{jobId:j.jobId});await reload();};
   }
  }
 }
 run.onclick=async()=>{try{out.textContent=JSON.stringify(await api.call('claude.start',{prompt:prompt.value}),null,2);await reload();}
  catch(e){out.textContent=e.message;}};
 refresh.onclick=()=>reload().catch(e=>out.textContent=e.message);
 await reload().catch(e=>out.textContent=e.message);
}

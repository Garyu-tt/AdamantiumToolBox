export async function mount(host,api){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 add('h2','Adamantium Orchestrator');
 add('p','Universal capability workflows: tasks are dispatched through the authorized MAS graph.');
 const status=add('p','Loading providers…'),refresh=add('button','Refresh jobs');
 const jobs=add('div'),out=add('pre','');
 const has=id=>api.graph().nodes.some(n=>n.id===id);
 async function reload(){
  jobs.replaceChildren();
  if(has('orchestrator.providers')){
   const providers=await api.call('orchestrator.providers');
   status.textContent=providers.length?'Allowed actions: '+providers.join(', '):'No authorized workflow actions configured';
  }
  if(!has('orchestrator.jobs'))return;
  for(const job of await api.call('orchestrator.jobs')){
   const line=add('div',job.jobId+' · '+job.status+' ',jobs);
   const show=add('button','Details',line);
   show.onclick=async()=>{out.textContent=JSON.stringify(await api.call('orchestrator.status',{jobId:job.jobId}),null,2);};
   if(has('orchestrator.cancel')&&['running','queued'].includes(job.status)){
    const cancel=add('button','Cancel',line);
    cancel.onclick=async()=>{out.textContent=JSON.stringify(await api.call('orchestrator.cancel',{jobId:job.jobId}));await reload();};
   }
  }
 }
 refresh.onclick=()=>reload().catch(e=>out.textContent=e.message);
 await reload().catch(e=>status.textContent=e.message);
}

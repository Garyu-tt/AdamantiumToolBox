// Optional legacy browser client. The service itself is native C++.
export async function mount(host,api) {
 const action='leonardo_native_vector.generate';
 const title=document.createElement('h2');title.textContent='Leonardo Native Vector';
 const prompt=document.createElement('textarea');prompt.rows=3;prompt.placeholder='Description';
 const button=document.createElement('button');button.textContent='Generate SVG';
 const state=document.createElement('p'),preview=document.createElement('img');
 preview.hidden=true;preview.alt='Native vector preview';preview.style.maxWidth='100%';
 host.append(title,prompt,button,state,preview);
 button.onclick=async()=>{
  button.disabled=true;preview.hidden=true;
  try {
   if(!api.graph().nodes.some(n=>n.id===action))throw Error('capability_unavailable');
   const result=await api.call(action,{kind:'image',format:'image/svg+xml',prompt:prompt.value,
    options:{width:512,height:320}});
   if(result.status!=='completed'||result.artifact?.mime!=='image/svg+xml')throw Error('bad_artifact');
   preview.src='data:image/svg+xml;base64,'+result.artifact.data;
   preview.hidden=false;state.textContent='Completed · C++ provider';
  }catch(error){state.textContent=error.message;}
  finally{button.disabled=false;}
 };
}

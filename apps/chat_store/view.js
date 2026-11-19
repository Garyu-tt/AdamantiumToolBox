export async function mount(host,api){
 const heading=document.createElement('h2');heading.textContent='Conversation Store';host.append(heading);
 const note=document.createElement('p');note.textContent='Журнал диалогов доступен через capability graph.';host.append(note);
 const src=api.graph().nodes.find(n=>n.protocol==='conversation-store-1');
 if(!src)return;
 const pre=document.createElement('pre');host.append(pre);
 try{const data=await api.call(src.actions.list,{});pre.textContent=JSON.stringify(data,null,2);}
 catch(e){pre.textContent=String(e.message);}
}

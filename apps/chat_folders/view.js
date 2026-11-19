export async function mount(host,api){
 const title=document.createElement('h3');title.textContent='Папки';host.append(title);
 const list=document.createElement('div'),state=document.createElement('small');host.append(state,list);
 const src=api.graph().nodes.find(n=>n.protocol==='chat-folders-1');
 if(!src){state.textContent='Хранилище папок недоступно';return;}
 let selected=null;
 window.addEventListener('mas-chat-selected-1',e=>{selected=e.detail?.thread;},{signal:host._masSignal});
 const render=async()=>{list.replaceChildren();const data=await api.call(src.actions.list);
  for(const f of data.folders){const row=document.createElement('div');
   const label=document.createElement('span');label.textContent=f.name+' ('+f.items.length+')';row.append(label);
   const add=document.createElement('button');add.textContent='Добавить чат';
   add.onclick=async()=>{if(!selected){state.textContent='Сначала выбери чат';return;}
    try{await api.call(src.actions.link,{folder:f.id,ref:'mas://chat_store/thread/'+selected,
     opId:crypto.randomUUID()});state.textContent='Добавлено';await render();}
    catch(err){state.textContent=err.message;}};row.append(add);list.append(row);}
 };
 const form=document.createElement('form'),input=document.createElement('input'),button=document.createElement('button');
 input.placeholder='Новая папка';button.textContent='+';form.append(input,button);host.append(form);
 form.onsubmit=async e=>{e.preventDefault();if(!input.value.trim())return;
  try{await api.call(src.actions.create,{name:input.value.trim(),opId:crypto.randomUUID()});input.value='';await render();}
  catch(err){state.textContent=String(err.message);}};
 try{await render();}catch(err){state.textContent=String(err.message);}
}

export async function mount(host,api){
 const h=document.createElement('h3');h.textContent='Чаты';host.append(h);
 const status=document.createElement('small'),list=document.createElement('div');host.append(status,list);
 const provider=()=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol==='conversation-store-1');
 const allowed=id=>api.graph().nodes.some(n=>n.id===id&&n.type==='action');
 const selected=id=>window.dispatchEvent(new CustomEvent('mas-chat-selected-1',{detail:{thread:id}}));
 const button=document.createElement('button');button.textContent='+ Новый чат';host.append(button);
 async function render(){
  const src=provider();list.replaceChildren();
  if(!src||!allowed(src.actions.list)){status.textContent='Хранилище бесед недоступно';button.disabled=true;return;}
  button.disabled=!allowed(src.actions.create);status.textContent='';
  try{const data=await api.call(src.actions.list);
   for(const t of data.threads){const b=document.createElement('button');
    b.textContent=t.title+' · '+t.count;b.type='button';b.onclick=()=>selected(t.id);list.append(b);}
  }catch(e){status.textContent=e.message;}
 }
 button.onclick=async()=>{const src=provider();if(!src||!allowed(src.actions.create))return;
  try{const data=await api.call(src.actions.create,{title:'Новый чат',opId:crypto.randomUUID()});
   selected(data.thread);await render();}catch(e){status.textContent=e.message;}
 };
 window.addEventListener('mas-chat-updated-1',render,{signal:host._masSignal});
 await render();
}

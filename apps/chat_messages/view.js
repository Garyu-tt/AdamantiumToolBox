export async function mount(host,api){
 const heading=document.createElement('h3'),status=document.createElement('small');
 const stream=document.createElement('div');host.append(heading,status,stream);
 let current=null;
 const source=()=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol==='conversation-store-1');
 const allowed=id=>api.graph().nodes.some(n=>n.id===id&&n.type==='action');
 const render=async()=>{
  const src=source();stream.replaceChildren();
  if(!src||!allowed(src.actions.read)){status.textContent='Чтение чатов недоступно';return;}
  if(!current){status.textContent='Выбери беседу';return;}
  try{const data=await api.call(src.actions.read,{thread:current});heading.textContent=data.thread.title;
   status.textContent=data.messages.length+' сообщений';
   for(const m of data.messages){const row=document.createElement('p');row.className='mas-chat-bubble';
    const name=document.createElement('strong');name.textContent=m.role+': ';row.append(name,document.createTextNode(m.text));stream.append(row);}
   stream.scrollTop=stream.scrollHeight;
  }catch(e){status.textContent=e.message;}
 };
 window.addEventListener('mas-chat-selected-1',e=>{current=e.detail?.thread;render();},{signal:host._masSignal});
 window.addEventListener('mas-chat-updated-1',render,{signal:host._masSignal});
 await render();
}

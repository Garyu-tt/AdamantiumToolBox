export async function mount(host,api){
 const form=document.createElement('form'),input=document.createElement('textarea');
 const send=document.createElement('button'),status=document.createElement('small');
 input.placeholder='Напиши сообщение…';input.rows=3;send.textContent='Отправить';
 form.append(input,send);host.append(form,status);let thread=null;
 const source=()=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol==='conversation-store-1');
 const allowed=id=>api.graph().nodes.some(n=>n.id===id&&n.type==='action');
 window.addEventListener('mas-chat-selected-1',e=>{thread=e.detail?.thread;},{signal:host._masSignal});
 form.onsubmit=async e=>{
  e.preventDefault();const src=source(),text=input.value.trim();
  if(!text||!src||!allowed(src.actions.append))return;
  send.disabled=true;
  try{
   if(!thread){if(!allowed(src.actions.create))throw Error('Невозможно создать беседу');
    const created=await api.call(src.actions.create,{title:text.slice(0,80),opId:crypto.randomUUID()});
    thread=created.thread;
    window.dispatchEvent(new CustomEvent('mas-chat-selected-1',{detail:{thread}}));}
   await api.call(src.actions.append,{thread,text,role:'user',opId:crypto.randomUUID()});
   input.value='';status.textContent='Сообщение сохранено';
   window.dispatchEvent(new CustomEvent('mas-chat-updated-1',{detail:{thread}}));
  }catch(err){status.textContent='Ошибка: '+err.message;}finally{send.disabled=false;}
 };
 status.textContent='Сообщения сохраняются в журнале; модель пока не подключена';
}

export async function mount(host,api){
 const form=document.createElement('form'),input=document.createElement('textarea');
 const send=document.createElement('button'),status=document.createElement('small');
 input.placeholder='Напиши сообщение…';input.rows=3;send.textContent='Отправить';
 form.append(input,send);host.append(form,status);let thread=null,pending=null;
 const find=protocol=>api.graph().nodes.find(n=>n.type==='resource'&&n.protocol===protocol);
 const allowed=id=>api.graph().nodes.some(n=>n.id===id&&n.type==='action');
 window.addEventListener('mas-chat-selected-1',e=>{thread=e.detail?.thread;},{signal:host._masSignal});
 form.onsubmit=async e=>{
  e.preventDefault();const src=find('conversation-store-1'),text=input.value.trim();
  if(!src||!allowed(src.actions.append))return;
  if(!pending){if(!text)return;pending={text,opId:crypto.randomUUID(),receipt:null,thread};}
  // Preserve opId through an ambiguous network error: never resend with a new identity.
  send.disabled=true;
  try{
   if(!pending.thread){if(!allowed(src.actions.create))throw Error('Невозможно создать беседу');
    const created=await api.call(src.actions.create,{title:pending.text.slice(0,80),opId:'thread-'+pending.opId});
    pending.thread=created.thread;thread=created.thread;
    window.dispatchEvent(new CustomEvent('mas-chat-selected-1',{detail:{thread}}));}
   if(!pending.receipt)pending.receipt=await api.call(src.actions.append,{
    thread:pending.thread,text:pending.text,role:'user',opId:pending.opId});
   const turns=find('conversation-turns-1');
   if(turns&&allowed(turns.actions.register)){
    await api.call(turns.actions.register,{thread:pending.thread,sourceId:pending.receipt.id,
     sourceSeq:pending.receipt.seq,opId:'intake-'+pending.opId});
    status.textContent='Сообщение сохранено и поставлено в очередь';
   }else status.textContent='Сообщение сохранено; очередь сейчас недоступна';
   if(input.value.trim()===pending.text)input.value='';pending=null;
   window.dispatchEvent(new CustomEvent('mas-chat-updated-1',{detail:{thread}}));
  }catch(err){status.textContent='Не подтверждена доставка: '+err.message+'; повтор использует тот же ID';}
  finally{send.disabled=false;}
 };
 status.textContent='Сообщения записываются до передачи модели; модель ещё не подключена';
}

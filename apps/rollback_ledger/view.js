export async function mount(host,api){
 const add=(tag,value)=>{const el=document.createElement(tag);
  if(value!==undefined)el.textContent=value;host.append(el);return el;};
 add('h2','Rollback Ledger');
 add('p','Локальные одноразовые бронирования. Не запускает watchdog и не меняет firewall.');
 const data=add('textarea');data.rows=12;data.style.width='100%';
 data.placeholder='{"receipt":{...},"context":{"expectedLeaseId":"..."}}';
 const output=add('pre');output.style.whiteSpace='pre-wrap';
 output.style.overflowWrap='anywhere';
 const controls=[
  ['rollback_ledger.audit','Проверить состояние после перезапуска',()=>({})],
  ['rollback_ledger.checkpoint','Вычислить отпечаток хранилища',()=>({})],
  ['rollback_ledger.inspect','Найти аренду по leaseId',()=>({
   leaseId:JSON.parse(data.value).leaseId})],
  ['rollback_ledger.reserve','Зарезервировать подписанное разрешение',()=>
   JSON.parse(data.value)]
 ];
 for(const [action,label,params] of controls){
  const button=add('button',label);
  button.disabled=!api.graph().nodes.some(x=>x.id===action);
  button.onclick=async()=>{try{
   const result=await api.call(action,params());
   output.textContent=JSON.stringify(result,null,2);
  }catch(e){output.textContent='Ошибка: '+e.message;}};
 }
}

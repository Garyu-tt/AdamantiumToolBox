export async function mount(host,api){
 const add=(tag,content)=>{const el=document.createElement(tag);
  if(content!==undefined)el.textContent=content;host.append(el);return el;};
 add('h2','Rollback Watchdog');
 add('p','Проверка подписи/журнала — не подтверждение работающего ядрового watchdog.');
 const input=add('textarea');input.rows=12;input.style.width='100%';
 input.placeholder='{"schema":"rollback-watchdog-journal-1","leaseId":"...","planDigest":"...","deadlineSeconds":0,"events":[]}';
 const output=add('pre');output.style.whiteSpace='pre-wrap';
 output.style.overflowWrap='anywhere';
 for(const [action,label] of [['rollback_watchdog.receipt','Проверить подпись одобрения'],
  ['rollback_watchdog.journal','Проверить цепочку журнала'],
  ['rollback_watchdog.diagnose','Показать граф блокеров']]){
  const button=add('button',label);
  button.disabled=!api.graph().nodes.some(x=>x.id===action);
  button.onclick=async()=>{try{const result=await api.call(action,JSON.parse(input.value));
   output.textContent=JSON.stringify(result,null,2);
  }catch(e){output.textContent='Ошибка: '+e.message;}};
 }
}

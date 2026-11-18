export async function showMesh(host,rpc){
 const info=await rpc('/api/mesh/status');
 const h=document.createElement('h2');h.textContent='Continuity Mesh';host.append(h);
 const summary=document.createElement('p');host.append(summary);
 const peers=info.peers||[];
 summary.textContent='Пакетов: '+(info.packages||0)+' · Узлов: '+peers.length+
  ' · Время: '+(info.at||'ещё не запускался');
 const table=document.createElement('table');table.className='mesh-table';
 const head=document.createElement('tr');
 for(const name of ['Узел','Статус','Ошибка']){
  const th=document.createElement('th');th.textContent=name;head.append(th);
 }
 table.append(head);
 for(const peer of peers){
  const row=document.createElement('tr');
  for(const value of [peer.id,peer.status,peer.error||'']){
   const td=document.createElement('td');td.textContent=value||'';row.append(td);
  }
  table.append(row);
 }
 host.append(table);
 const note=document.createElement('p');note.className='mas-note';
 note.textContent='Пакеты проверяются по подписи и передаются доверенным узлам. Установка и исполнение не выполняются автоматически в этой версии.';
 host.append(note);
}

export async function showGraphs(host,rpc){
 const [backend,stored]=await Promise.all([rpc('/api/graph'),rpc('/api/frontend')]);
 const pane=document.createElement('div');pane.className='system-columns';host.append(pane);
 const create=(title,items)=>{
  const col=document.createElement('section');col.className='system-col';pane.append(col);
  const h=document.createElement('h3');h.textContent=title;col.append(h);
  if(!items.length){const p=document.createElement('p');p.textContent='Пустой граф';col.append(p);}
  for(const item of items){
   const div=document.createElement('div');div.className='system-node';
   div.textContent=item;col.append(div);
  }
 };
 create('Frontend Graph',stored.frontend.nodes.map(n=>n.id+' · '+n.kind));
 create('Binding Graph',stored.bridge.edges.map(e=>e.from+' → '+e.to));
 create('Backend Graph',backend.nodes.map(n=>n.id+' · '+n.type));
 const metadata=document.createElement('small');
 metadata.textContent='Frontend и Backend изолированы. Bridge задаёт явные связи, API проверяет права при вызове.';
 host.append(metadata);
}

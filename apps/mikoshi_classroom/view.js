// Composes visible skill providers by discovery; no fixed app-to-app dependencies.
export async function mount(host,api){
 host.replaceChildren();
 const title=document.createElement('h2');title.textContent='Mikoshi Classroom';
 host.append(title);
 const panel=document.createElement('section');host.append(panel);
 const reload=document.createElement('button');reload.textContent='Refresh capabilities';
 host.append(reload);
 function refresh(){
  panel.replaceChildren();
  const nodes=api.graph().nodes||[];
  const providers=nodes.filter(n=>n.type==='resource'&&n.skill?.schema==='mikoshi.skill.v1');
  const h=document.createElement('p');
  h.textContent='Live learning and speech providers: '+providers.length;panel.append(h);
  for(const n of providers){
   const item=document.createElement('details'),summary=document.createElement('summary');
   summary.textContent=n.skill.domain+' — '+n.id;item.append(summary);
   const pre=document.createElement('pre');
   pre.textContent=JSON.stringify(n.skill.actions,null,2);item.append(pre);
   panel.append(item);
  }
 }
 reload.onclick=refresh;refresh();
}

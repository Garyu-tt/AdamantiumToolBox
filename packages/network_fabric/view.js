// Optional UI: a read-only network graph. Core+network_fabric remains useful without it.
export async function mount(host,api){
 const wrap=document.createElement('section');wrap.style.cssText='display:grid;gap:12px;';host.append(wrap);
 const heading=document.createElement('h2');heading.textContent='Network Fabric · read-only';wrap.append(heading);
 const summary=document.createElement('p');wrap.append(summary);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 620 360');svg.setAttribute('role','img');
 svg.setAttribute('aria-label','Directed network topology');svg.style.cssText='width:100%;max-height:500px;border:1px solid currentColor;border-radius:8px;';wrap.append(svg);
 const detail=document.createElement('pre');detail.style.whiteSpace='pre-wrap';wrap.append(detail);
 const make=(tag,attrs={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));svg.append(el);return el;};
 try {
  const reply=await api.call('network_fabric.topology',{}),t=reply.topology;
  if(!t||!Array.isArray(t.nodes)){summary.textContent='Graph response unavailable';return;}
  summary.textContent=`${t.nodes.length} nodes · ${t.links.length} directed links · revision ${t.revision??'unknown'}`;
  const n=t.nodes.length;const positions=new Map(t.nodes.map((node,i)=>{const angle=2*Math.PI*i/Math.max(n,1)-Math.PI/2;return [node.id,{x:310+Math.cos(angle)*215,y:178+Math.sin(angle)*126}];}));
  for(const link of t.links){const a=positions.get(link.from),b=positions.get(link.to);if(!a||!b)continue;
   const line=make('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'currentColor','stroke-width':link.up?2:1,'stroke-dasharray':link.up?'':'5 5',opacity:link.up?'.8':'.25'});
   const label=document.createElementNS('http://www.w3.org/2000/svg','title');label.textContent=`${link.from} → ${link.to} (metric ${link.cost}; ${link.up?'up':'down'})`;line.append(label);
  }
  for(const node of t.nodes){const p=positions.get(node.id),g=make('g');g.setAttribute('role','button');g.setAttribute('tabindex','0');
   const c=document.createElementNS('http://www.w3.org/2000/svg','circle');for(const [k,v] of Object.entries({cx:p.x,cy:p.y,r:24,fill:'none',stroke:'currentColor','stroke-width':node.online?3:1,'stroke-dasharray':node.online?'':'3 4'}))c.setAttribute(k,String(v));g.append(c);
   const title=document.createElementNS('http://www.w3.org/2000/svg','text');title.setAttribute('x',p.x);title.setAttribute('y',p.y+38);title.setAttribute('text-anchor','middle');title.setAttribute('fill','currentColor');title.setAttribute('font-size','12');title.textContent=node.label;g.append(title);
   const show=()=>{detail.textContent=JSON.stringify({node:node.id,online:node.online,outgoing:t.links.filter(e=>e.from===node.id)},null,2);};g.addEventListener('click',show);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
  }
 }catch(e){summary.textContent='Topology cannot be read in this session';detail.textContent=String(e.message).slice(0,160);}
}

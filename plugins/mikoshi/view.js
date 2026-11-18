"""Dynamic Mechanicus view for live Mikoshi capability graph."""
export async function mount(host,api){
 host.replaceChildren();
 const create=(tag,text,parent=host)=>{
  const el=document.createElement(tag);
  if(text!==undefined)el.textContent=text;
  parent.append(el);return el;
 };
 create('h2','Mikoshi · Connectome');
 const info=create('p','Capability discovery…');
 const commands=create('section');
 const output=create('pre','');
 output.style.whiteSpace='pre-wrap';output.style.overflowWrap='anywhere';
 const canvas=create('canvas');canvas.width=950;canvas.height=480;
 canvas.style.width='100%';canvas.style.maxHeight='480px';canvas.hidden=true;
 const reload=create('button','Обновить доступные возможности');
 const own=()=>api.graph().nodes.filter(n=>n.type==='action'&&
   n.id.startsWith('mikoshi.'));
 const coord=n=>{
  if(Number.isFinite(n.x)&&Number.isFinite(n.y))return [n.x,n.y];
  if(Array.isArray(n.position)&&n.position.length===2&&
     n.position.every(Number.isFinite))return n.position;
  return null;
 };
 function visual(data){
  const source=data?.graph||data;
  const nodes=source?.nodes,edges=source?.edges;
  if(!Array.isArray(nodes)||!Array.isArray(edges))return false;
  const candidates=nodes.map(n=>[n,coord(n)]).filter(x=>x[1]);
  if(!candidates.length)return false;
  const limit=2500,chosen=candidates.slice(0,limit);
  const px=chosen.map(x=>x[1][0]),py=chosen.map(x=>x[1][1]);
  const x0=Math.min(...px),x1=Math.max(...px);
  const y0=Math.min(...py),y1=Math.max(...py);
  const sx=880/(x1-x0||1),sy=410/(y1-y0||1);
  const mapping=new Map(chosen.map(([n,pos])=>[n.id,[
   35+(pos[0]-x0)*sx,35+(pos[1]-y0)*sy]]));
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const fg=getComputedStyle(host).color||'#999';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=fg;ctx.fillStyle=fg;ctx.globalAlpha=.25;
  for(const edge of edges){
   const a=mapping.get(edge.source||edge.from),b=mapping.get(edge.target||edge.to);
   if(!a||!b)continue;
   ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  }
  ctx.globalAlpha=1;
  for(const pos of mapping.values()){
   ctx.beginPath();ctx.arc(pos[0],pos[1],2,0,Math.PI*2);ctx.fill();
  }
  canvas.hidden=false;
  info.textContent='2D: '+chosen.length+' / '+candidates.length+
    ' source points (display limit '+limit+')';
  return true;
 }
 async function call(id){
  output.textContent='Запрос '+id+'…';canvas.hidden=true;
  try{
   const data=await api.call(id,{});
   const summary=JSON.stringify(data,null,2);
   output.textContent=summary.length>17000?summary.slice(0,17000)+'\n…[truncated]':summary;
   visual(data);
  }catch(e){output.textContent='Ошибка: '+String(e.message).slice(0,240);}
 }
 function refresh(){
  commands.replaceChildren();
  const actions=own().sort((a,b)=>a.id.localeCompare(b.id));
  info.textContent=actions.length?'Доступно действий: '+actions.length:
    'Нет разрешённых действующих возможностей';
  for(const n of actions){
   const button=create('button',n.title||n.id,commands);
   button.title=n.id;button.onclick=()=>call(n.id);
  }
 }
 reload.onclick=refresh;
 refresh();
 const status=own().find(x=>x.id==='mikoshi.status');
 if(status)await call(status.id);
}

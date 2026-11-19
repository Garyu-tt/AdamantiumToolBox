const NS='http://www.w3.org/2000/svg';
const layerOrder=['project','plugin','module','capability','task','dependency','artifact','node','file'];
const make=(tag,parent,attrs={},text)=>{
 const e=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));
 if(text!==undefined)e.textContent=String(text);
 parent.append(e);return e;
};
export function renderGraph(host,graph,selected,select){
 host.replaceChildren();
 const columns=new Map(),pos=new Map();
 for(const n of graph.nodes){
  const c=layerOrder.indexOf(n.kind);const col=c<0?3:c;
  if(!columns.has(col))columns.set(col,[]);columns.get(col).push(n);
 }
 const width=Math.max(570,((Math.max(-1,...columns.keys()))+1)*215),height=Math.max(250,...[...columns.values()].map(a=>a.length*55+55));
 const svg=make('svg',host,{viewBox:`0 0 ${width} ${height}`,role:'img',
  'aria-label':'Граф возможностей и задач Mechanicus',class:'gm-canvas'});
 for(const [col,nodes] of columns){
  nodes.sort((a,b)=>a.id.localeCompare(b.id));
  nodes.forEach((n,i)=>pos.set(n.id,{x:col*215+98,y:30+i*55}));
 }
 for(const e of graph.edges){
  const a=pos.get(e.from),b=pos.get(e.to);if(!a||!b)continue;
  make('line',svg,{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'gm-edge'});
 }
 for(const n of graph.nodes){
  const {x,y}=pos.get(n.id);const group=make('g',svg,{class:'gm-vertex'+
   (n.status==='blocked'?' gm-blocked':'')+(selected===n.id?' gm-selected':''),
   role:'button',tabindex:'0','aria-label':`${n.title} · ${n.status}`});
  make('rect',group,{x:x-93,y:y-18,width:187,height:36,rx:9});
  make('text',group,{x:x-82,y:y+4},(n.status==='blocked'?'! ':'')+n.title.slice(0,24));
  make('title',group,{},n.id+' · '+n.kind+' · '+n.status);
  group.onclick=()=>select(n.id);
  group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id);}};
 }
}
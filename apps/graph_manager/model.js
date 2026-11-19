const TYPES=new Set(['project','plugin','module','capability','task','dependency','artifact','node']);
const STATUS=new Set(['blocked','failed','running','queued','completed','unknown']);
const safe=s=>typeof s==='string'&&s.length>0&&s.length<=160;
const claim=s=>typeof s==='string'&&s.length<=600?s:null;
const typed=n=>n?.entity?.schema==='mas-graph-entity-1'&&TYPES.has(n.entity.kind);
const provenance={type:'core_capability_graph',trust:'runtime_visibility_not_deployment_proof'};
export function projectGraph(input){
 const raw=Array.isArray(input?.nodes)?input.nodes:[],links=Array.isArray(input?.edges)?input.edges:[];
 const nodes=[],edges=[],missing=[],seen=new Set(),owners=new Map();
 for(const item of raw){
  if(!safe(item?.id)||seen.has(item.id))continue;
  seen.add(item.id);
  const owner=item.id.split('.')[0];
  if(!/^[a-z][a-z0-9_-]{1,39}$/.test(owner))continue;
  const ent=typed(item)?item.entity:null;
  const status=STATUS.has(ent?.status)?ent.status:'unknown';
  const title=claim(ent?.title)||claim(item.title)||item.id;
  nodes.push({id:item.id,kind:ent?.kind||'capability',title,
   status,owner,reason:claim(ent?.reason),diagnostic:claim(ent?.diagnostic),
   responsible:claim(ent?.responsible),remediation:claim(ent?.remediation),
   source:ent?.source||provenance,observed:true});
  if(!owners.has(owner))owners.set(owner,'mas:'+owner);
 }
 for(const [owner,id] of owners){
  nodes.push({id,kind:'plugin',title:owner,status:'unknown',owner,source:provenance,
   observed:true,derived:true});
 }
 const ids=new Set(nodes.map(n=>n.id));
 for(const n of nodes)if(n.kind!=='plugin')edges.push({from:'mas:'+n.owner,to:n.id,type:'contains'});
 for(const e of links){
  if(!safe(e?.from)||!safe(e?.to)||!safe(e?.type))continue;
  const copy={from:e.from,to:e.to,type:e.type};
  if(ids.has(copy.from)&&ids.has(copy.to))edges.push(copy);
  else missing.push(copy);
 }
 return {schema:'mechanicus-graph-snapshot-1',nodes,edges,missing,cycles:findCycles(nodes,edges)};
}
export function findCycles(nodes,edges){
 const all=new Set(nodes.map(n=>n.id)),adj=new Map(),state=new Map(),stack=[],cycles=[];
 for(const e of edges)if(all.has(e.from)&&all.has(e.to)){
  if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e.to);
 }
 function visit(id){
  state.set(id,1);stack.push(id);
  for(const to of adj.get(id)||[]){
   if(state.get(to)===1)cycles.push([...stack.slice(stack.indexOf(to)),to]);
   else if(!state.has(to))visit(to);
  }
  stack.pop();state.set(id,2);
 }
 for(const n of nodes)if(!state.has(n.id))visit(n.id);
 return cycles;
}
export function impacted(graph,id){
 const reverse=new Map();
 for(const e of graph.edges)if(e.type==='depends'){
  if(!reverse.has(e.to))reverse.set(e.to,[]);reverse.get(e.to).push(e.from);
 }
 const seen=new Set([id]),queue=[id];
 for(let i=0;i<queue.length;i++)for(const next of reverse.get(queue[i])||[])
  if(!seen.has(next)){seen.add(next);queue.push(next);}
 return queue.slice(1);
}
export function filterGraph(graph,{query='',layer='all',blockers=false}={}){
 const q=String(query).trim().toLowerCase();
 const nodes=graph.nodes.filter(n=>(layer==='all'||n.kind===layer)&&(!blockers||n.status==='blocked')&&
  (!q||(n.id+' '+n.title+' '+(n.reason||'')).toLowerCase().includes(q)));
 const ids=new Set(nodes.map(n=>n.id));
 return {...graph,nodes,edges:graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))};
}
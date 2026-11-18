// Visible topology is a public *projection* of local host state. Never serialize secrets.
const ident=v=>typeof v==='string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
const limitNodes=256, limitLinks=1024;
export function sanitizeTopology(doc) {
 const nodes=Array.isArray(doc?.nodes)?doc.nodes:[],links=Array.isArray(doc?.links)?doc.links:[];
 if(nodes.length>limitNodes||links.length>limitLinks)throw Error('topology_limit');
 const visible=nodes.filter(n=>ident(n?.id)).map(n=>({id:n.id,
   label:typeof n.label==='string'?n.label.slice(0,80):n.id,
   online:n.online===true}));
 const ids=new Set(visible.map(n=>n.id));if(ids.size!==visible.length)throw Error('duplicate_node');
 const edges=links.filter(l=>ids.has(l?.from)&&ids.has(l?.to)&&l.from!==l.to &&
   Number.isSafeInteger(l.cost)&&l.cost>0&&l.cost<=100000).map(l=>({from:l.from,to:l.to,cost:l.cost,up:l.up===true}));
 return {nodes:visible,links:edges,revision:typeof doc?.revision==='string'?doc.revision.slice(0,100):null};
}
// Candidate directed shortest path. It does NOT grant permissions or install a route.
export function planRoute({topology,source,destination}) {
 if(!ident(source)||!ident(destination)||source===destination) return {status:'invalid_endpoints',applied:false};
 const t=sanitizeTopology(topology), available=t.nodes.filter(n=>n.online).map(n=>n.id),seen=new Set(available);
 if(!seen.has(source)||!seen.has(destination))return {status:'endpoint_offline_or_unknown',applied:false};
 const distances=new Map(available.map(id=>[id,Infinity])),previous=new Map(),unvisited=new Set(available);
 distances.set(source,0);
 while(unvisited.size) {
   let best=null;for(const n of unvisited)if(best===null||distances.get(n)<distances.get(best))best=n;
   if(best===null||!Number.isFinite(distances.get(best)))break;
   unvisited.delete(best);if(best===destination)break;
   for(const e of t.links){if(e.from!==best||!e.up||!unvisited.has(e.to))continue;
      const alt=distances.get(best)+e.cost;
      if(alt<distances.get(e.to)){distances.set(e.to,alt);previous.set(e.to,best);}}
 }
 if(!Number.isFinite(distances.get(destination)))return {status:'unreachable',applied:false};
 const path=[destination];while(path[0]!==source){const prev=previous.get(path[0]);if(!prev)return {status:'unreachable',applied:false};path.unshift(prev);}
 return {status:'candidate',path,cost:distances.get(destination),applied:false,authorization:'not_evaluated'};
}

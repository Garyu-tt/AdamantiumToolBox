// Adamantium Genome Architecture R01 — deterministic, inert graph-genome codec.
// No runtime dispatch, plugin install, signature acceptance, secret storage or genome self-rewrite.
// Native G0 C++17 graph compiler remains the authoritative structural compiler.
import {createHash} from 'node:crypto';

export const GRAPH_SCHEMA='mechanicus.universal-graph/1';
export const GENOME_SCHEMA='mechanicus.adamantium-genome/1';
export const MAX_GENES=300000;
export const check=(ok,msg)=>{if(!ok)throw new RangeError(msg)};
export const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
export const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export const name=/^[a-z][a-z0-9_.-]{0,127}$/;
const ref=/^[a-z][a-z0-9_.-]*@[1-9][0-9]*$/;
const domains=new Set(['general','program','genesis','neural','infrastructure','interface']);
const kinds=new Set(['capability','composite','service','device','sensor','effector','brain-region','resource','view','policy']);
const semantics=new Set(['data','control','event','signal','dependency','permission','route']);
export const keys=(o,required)=>plain(o)&&
 Object.keys(o).length===required.length&&required.every(k=>Object.hasOwn(o,k));
export const cpy=v=>JSON.parse(JSON.stringify(v));
export const hash=v=>'sha256:'+createHash('sha256').update(JSON.stringify(v,(_key,x)=>
 plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)).digest('hex');
function validatePort(p){
 check(keys(p,['id','dataType','direction','semantics'])&&name.test(p.id)&&ref.test(p.dataType)&&
  (p.direction==='input'||p.direction==='output')&&semantics.has(p.semantics),
  'invalid_genome_port');
}
export function validateGraphShape(g){
 check(keys(g,['schema','id','schemaVersion','revision','domain','interfacePorts','nodes','edges'])&&
  g.schema===GRAPH_SCHEMA&&name.test(g.id)&&g.schemaVersion===1&&
  int(g.revision,1,Number.MAX_SAFE_INTEGER)&&domains.has(g.domain)&&
  Array.isArray(g.interfacePorts)&&g.interfacePorts.length<=4096&&
  Array.isArray(g.nodes)&&g.nodes.length<=100000&&
  Array.isArray(g.edges)&&g.edges.length<=200000,'invalid_canonical_graph');
 const topPorts=new Set();
 for(const p of g.interfacePorts){validatePort(p);check(!topPorts.has(p.id),'duplicate_interface_port');topPorts.add(p.id);}
 const nodes=new Map();
 for(const n of g.nodes){
  check(keys(n,['id','kind','typeRef','graphRef','graphRefRevision','ports'])&&name.test(n.id)&&
   kinds.has(n.kind)&&typeof n.typeRef==='string'&&typeof n.graphRef==='string'&&
   int(n.graphRefRevision,0,Number.MAX_SAFE_INTEGER)&&
   Array.isArray(n.ports)&&n.ports.length<=4096&&
   !nodes.has(n.id),'invalid_genome_node');
  if(n.kind==='composite')check(n.typeRef===''&&name.test(n.graphRef)&&n.graphRefRevision>=1,'invalid_composite_ref');
  else check(ref.test(n.typeRef)&&n.graphRef===''&&n.graphRefRevision===0,'invalid_type_ref');
  const ps=new Map();
  for(const p of n.ports){validatePort(p);check(!ps.has(p.id),'duplicate_node_port');ps.set(p.id,p)}
  nodes.set(n.id,ps);
 }
 const edgeIds=new Set();
 for(const e of g.edges){
  check(keys(e,['id','fromNode','fromPort','toNode','toPort','semantics','delayTicks'])&&
   name.test(e.id)&&name.test(e.fromNode)&&name.test(e.toNode)&&
   name.test(e.fromPort)&&name.test(e.toPort)&&semantics.has(e.semantics)&&
   int(e.delayTicks,0,4294967295)&&!edgeIds.has(e.id),
   'invalid_genome_edge');
  edgeIds.add(e.id);
  const src=nodes.get(e.fromNode)?.get(e.fromPort);
  const dst=nodes.get(e.toNode)?.get(e.toPort);
  check(src&&dst&&src.direction==='output'&&dst.direction==='input'&&
   src.dataType===dst.dataType&&src.semantics===e.semantics&&
   dst.semantics===e.semantics,'invalid_edge_contract');
  check(e.delayTicks===0||e.semantics==='event'||e.semantics==='signal','illegal_edge_delay');
 }
 return g;
}

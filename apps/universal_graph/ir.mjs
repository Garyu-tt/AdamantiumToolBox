// MAS Universal Graph IR v1: pure, non-executing, editor-independent validation.
// Graph structure is a DESCRIPTION, never an authorization or a live capability.
export const UNIVERSAL_GRAPH_SCHEMA='mas.universal-graph.v1';
const id=/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;
const contract=/^[a-z][a-z0-9_.-]{2,95}$/;
const semver=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const kinds=new Set(['capability','composite','neural_region','resource','device','ui','policy']);
const roles=new Set(['data','control','event','neural','authority','dependency']);
const dagRoles=new Set(['data','control','dependency']);
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const assert=(ok,reason)=>{if(!ok)throw new RangeError(reason)};
const whole=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
export function validateUniversalGraph(graph,{maxNodes=512,maxEdges=4096}={}){
 assert(plain(graph)&&graph.schema===UNIVERSAL_GRAPH_SCHEMA&&id.test(graph.id)&&
  whole(graph.revision,0,Number.MAX_SAFE_INTEGER),'invalid_graph_header');
 assert(whole(maxNodes,1,100000)&&whole(maxEdges,1,1000000),'invalid_budgets');
 assert(Array.isArray(graph.nodes)&&graph.nodes.length<=maxNodes&&
  Array.isArray(graph.edges)&&graph.edges.length<=maxEdges,'graph_budget_exceeded');
 const nodeById=new Map(),allPorts=new Map();
 for(const n of graph.nodes){
  assert(plain(n)&&id.test(n.id)&&kinds.has(n.kind)&&!nodeById.has(n.id)&&
   Array.isArray(n.ports)&&n.ports.length<=128,'invalid_node');
  if(n.binding!==undefined){
   assert(n.kind==='capability'&&plain(n.binding)&&contract.test(n.binding.contract)&&
    semver.test(n.binding.version),'invalid_capability_binding');
  }
  if(n.graphRef!==undefined){
   assert(n.kind==='composite'&&plain(n.graphRef)&&id.test(n.graphRef.id)&&
    whole(n.graphRef.revision,0,Number.MAX_SAFE_INTEGER),'invalid_subgraph_ref');
  }
  const seen=new Set();
  for(const p of n.ports){
   assert(plain(p)&&id.test(p.id)&&!seen.has(p.id)&&
    (p.direction==='in'||p.direction==='out')&&roles.has(p.role)&&
    contract.test(p.datatype),'invalid_port');
   seen.add(p.id);
  }
  nodeById.set(n.id,n);
  allPorts.set(n.id,new Map(n.ports.map(p=>[p.id,p])));
 }
 const seenEdges=new Set(),dag=[];
 for(const e of graph.edges){
  assert(plain(e)&&id.test(e.id)&&!seenEdges.has(e.id)&&roles.has(e.kind)&&
   plain(e.source)&&plain(e.target),'invalid_edge');
  const from=allPorts.get(e.source.node)?.get(e.source.port);
  const to=allPorts.get(e.target.node)?.get(e.target.port);
  assert(from&&to&&from.direction==='out'&&to.direction==='in'&&
   from.role===e.kind&&to.role===e.kind&&from.datatype===to.datatype,
   'incompatible_typed_ports');
  assert(e.source.node!==e.target.node||!dagRoles.has(e.kind),'self_cycle_forbidden');
  // Non-DAG feedback is explicit and never silently made executable.
  if(e.feedback!==undefined)assert(e.feedback===true,'invalid_feedback');
  if(e.source.node===e.target.node)assert(e.feedback===true,'feedback_must_be_declared');
  if(dagRoles.has(e.kind))dag.push([e.source.node,e.target.node]);
  seenEdges.add(e.id);
 }
 // Kahn over DAG-only semantics. Neural/event feedback is handled by its own executor.
 const degree=new Map([...nodeById.keys()].map(k=>[k,0])),adj=new Map();
 for(const [a,b] of dag){
  degree.set(b,degree.get(b)+1);
  if(!adj.has(a))adj.set(a,[]);
  adj.get(a).push(b);
 }
 const queue=[...degree].filter(([,n])=>n===0).map(([k])=>k);
 for(let i=0;i<queue.length;i++)
  for(const next of adj.get(queue[i])||[]){
   degree.set(next,degree.get(next)-1);
   if(degree.get(next)===0)queue.push(next);
  }
 assert(queue.length===nodeById.size,'directed_execution_cycle');
 return graph;
}
// UI adapters can consume these records; no Rete dependency or browser state.
export function editorProjection(graph){
 validateUniversalGraph(graph);
 return {schema:UNIVERSAL_GRAPH_SCHEMA,graphId:graph.id,revision:graph.revision,
  nodes:graph.nodes.map(n=>({id:n.id,kind:n.kind,title:n.title||n.id,
   ports:n.ports.map(p=>({...p})),graphRef:n.graphRef?{...n.graphRef}:null})),
  edges:graph.edges.map(e=>({id:e.id,kind:e.kind,
   source:{...e.source},target:{...e.target},feedback:e.feedback===true})),
  executable:false,authorityGranted:false};
}

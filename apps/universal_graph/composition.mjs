// Resolve nested Universal Graph descriptors only. No provider invocation.
import {validateUniversalGraph} from './ir.mjs';
const check=(ok,msg)=>{if(!ok)throw new RangeError(msg)};
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
export function planGraphComposition(rootId,documents,{maxDepth=16,maxGraphs=512}={}){
 check(typeof rootId==='string'&&Array.isArray(documents)&&
  int(maxDepth,1,256)&&int(maxGraphs,1,100000),'invalid_composition_request');
 const byId=new Map();
 for(const graph of documents){
  validateUniversalGraph(graph);
  check(!byId.has(graph.id),'duplicate_graph_definition');
  byId.set(graph.id,graph);
 }
 check(byId.has(rootId),'root_graph_missing');
 const seen=new Set(),visiting=new Set(),visits=[];
 const walk=(graphId,depth)=>{
  check(depth<=maxDepth,'composite_depth_budget');
  check(!visiting.has(graphId),'recursive_composite_cycle');
  const graph=byId.get(graphId);
  check(graph!==undefined,'referenced_graph_missing');
  check(visits.length<maxGraphs,'composite_graph_budget');
  if(seen.has(graphId))return;
  visiting.add(graphId);
  visits.push({id:graph.id,revision:graph.revision,depth});
  for(const n of graph.nodes){
   if(!n.graphRef)continue;
   const child=byId.get(n.graphRef.id);
   check(child!==undefined&&child.revision===n.graphRef.revision,
    'subgraph_revision_unavailable');
   walk(child.id,depth+1);
  }
  visiting.delete(graphId);
  seen.add(graphId);
 };
 walk(rootId,0);
 return {schema:'mas.universal-graph-composition-plan.v1',rootId,
  graphs:visits,discovered:true,runnable:false,
  reason:'descriptors_only_no_live_capability_authorization'};
}

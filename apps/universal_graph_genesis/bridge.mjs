// G3: read-only bridge from GenesisPE graph.v1 to Mechanicus Universal Graph IR v1.
// Pure, editor-free, CPU-first. Never executes capabilities, changes permissions,
// copies neuron weights, chemistry state, credentials or network configuration.
export const GENESIS_GRAPH_SCHEMA='genesis.pe.graph.v1';
export const UNIVERSAL_GRAPH_SCHEMA='mechanicus.universal-graph/1';
const fail=(ok,reason)=>{if(!ok)throw new RangeError(reason);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const name=/^[a-z][a-z0-9_.-]{0,127}$/;
const legacyContract=/^([a-z][a-z0-9_.-]{2,125})\.v([1-9][0-9]*)$/;
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const cleanName=(x,kind)=>{fail(typeof x==='string'&&name.test(x),'invalid_'+kind);return x;};
const port=(id,dataType,direction,semantics)=>({id,dataType,direction,semantics});
const SIGNAL_TYPE='genesis.signal@1';
const ROUTE_TYPE='mechanicus.capability.route@1';

/**
 * No silent ID normalization or implicit authority. The caller must explicitly
 * migrate invalid legacy names rather than receiving a mismatched state mapping.
 */
export function exportGenesisToUniversal(source,{id='genesis.brain',revision=1,signalDelayTicks=1}={}){
 fail(obj(source)&&source.schema===GENESIS_GRAPH_SCHEMA,'invalid_genesis_schema');
 cleanName(id,'graph_id');
 fail(integer(revision,1,Number.MAX_SAFE_INTEGER),'invalid_revision');
 fail(integer(signalDelayTicks,1,65535),'signal_delay_required');
 fail(Array.isArray(source.nodes)&&source.nodes.length<=100000&&
  Array.isArray(source.edges)&&source.edges.length<=200000,'graph_budget_exceeded');
 const nodes=[],edges=[],sourceIds=new Map(),originalPortAliases={};
 for(const n of source.nodes){
  fail(obj(n)&&typeof n.id==='string','invalid_source_node');
  const nodeId=cleanName(n.id,'node_id');
  fail(!sourceIds.has(nodeId),'duplicate_source_node');
  fail(n.kind==='region'||n.kind==='hub','unsupported_source_node_kind');
  sourceIds.set(nodeId,n.kind);
  const p=[];
  if(n.kind==='region'){
   p.push(port('signal_in',SIGNAL_TYPE,'input','signal'));
   p.push(port('signal_out',SIGNAL_TYPE,'output','signal'));
   p.push(port('route_out',ROUTE_TYPE,'output','route'));
   fail(Array.isArray(n.ports)&&n.ports.length<=32,'invalid_source_ports');
   const seen=new Set();
   const aliases=[];
   for(const x of n.ports){
    fail(obj(x)&&typeof x.id==='string'&&name.test(x.id)&&
     (x.direction==='in'||x.direction==='out')&&
     typeof x.contract==='string','invalid_source_port');
    fail(!seen.has(x.id),'duplicate_source_port');seen.add(x.id);
    const match=legacyContract.exec(x.contract);
    fail(Boolean(match),'legacy_contract_version_required');
    const normalized=match[1]+'@'+match[2];
    const aliasId='cap_'+x.id;
    fail(name.test(aliasId),'invalid_generated_port_id');
    p.push(port(aliasId,normalized,x.direction==='in'?'input':'output','data'));
    aliases.push({original:x.id,universal:aliasId});
   }
   originalPortAliases[nodeId]=aliases;
  }else{
   p.push(port('route_in',ROUTE_TYPE,'input','route'));
  }
  nodes.push({id:nodeId,kind:n.kind==='region'?'brain-region':'service',
   typeRef:n.kind==='region'?'genesis.region@1':'mechanicus.connector.hub@1',
   graphRef:'',graphRefRevision:0,ports:p});
 }
 const seenEdges=new Set();
 for(const e of source.edges){
  fail(obj(e)&&typeof e.id==='string','invalid_source_edge');
  const edgeId=cleanName(e.id,'edge_id');
  fail(!seenEdges.has(edgeId),'duplicate_source_edge');seenEdges.add(edgeId);
  const from=sourceIds.get(e.from),to=sourceIds.get(e.to);
  fail(from!==undefined&&to!==undefined,'orphan_source_edge');
  fail(e.from!==e.to,'self_edge_not_supported');
  if(e.kind==='synapse'){
   fail(from==='region'&&to==='region'&&integer(e.minLinks,0,1000000000000)&&
    integer(e.maxLinks,e.minLinks,1000000000000),'invalid_synapse_projection');
   edges.push({id:edgeId,fromNode:e.from,fromPort:'signal_out',
    toNode:e.to,toPort:'signal_in',semantics:'signal',delayTicks:signalDelayTicks});
  }else if(e.kind==='route'){
   fail(from==='region'&&to==='hub','invalid_route_projection');
   edges.push({id:edgeId,fromNode:e.from,fromPort:'route_out',
    toNode:e.to,toPort:'route_in',semantics:'route',delayTicks:0});
  }else fail(false,'unsupported_source_edge_kind');
 }
 const graph={schema:UNIVERSAL_GRAPH_SCHEMA,id,schemaVersion:1,revision,
  domain:'neural',interfacePorts:[],nodes,edges};
 return {graph,provenance:{sourceSchema:GENESIS_GRAPH_SCHEMA,
  sourceVersion:source.version??null,sourceNodeCount:source.nodes.length,
  sourceEdgeCount:source.edges.length,originalPortAliases,
  executionAuthorized:false,networkChangesAuthorized:false,
  runtimeStateCopied:false,chemistryCopied:false}};
}

export function extractGenesisGraph(file){
 fail(obj(file),'invalid_genesis_document');
 const source=file.graph??file;
 fail(obj(source)&&source.schema===GENESIS_GRAPH_SCHEMA,'invalid_genesis_document');
 return source;
}

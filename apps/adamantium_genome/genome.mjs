// Adamantium Genome Architecture R01 — deterministic, inert graph-genome codec.
// No runtime dispatch, plugin install, signature acceptance, secret storage or genome self-rewrite.
// Native G0 C++17 graph compiler remains the authoritative structural compiler.
import {createHash} from 'node:crypto';

export const GRAPH_SCHEMA='mechanicus.universal-graph/1';
export const GENOME_SCHEMA='mechanicus.adamantium-genome/1';
export const MAX_GENES=300000;
const check=(ok,msg)=>{if(!ok)throw new RangeError(msg)};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const name=/^[a-z][a-z0-9_.-]{0,127}$/;
const ref=/^[a-z][a-z0-9_.-]*@[1-9][0-9]*$/;
const domains=new Set(['general','program','genesis','neural','infrastructure','interface']);
const kinds=new Set(['capability','composite','service','device','sensor','effector','brain-region','resource','view','policy']);
const semantics=new Set(['data','control','event','signal','dependency','permission','route']);
const keys=(o,required)=>plain(o)&&
 Object.keys(o).length===required.length&&required.every(k=>Object.hasOwn(o,k));
const cpy=v=>JSON.parse(JSON.stringify(v));
const hash=v=>'sha256:'+createHash('sha256').update(JSON.stringify(v)).digest('hex');
function validatePort(p){
 check(keys(p,['id','dataType','direction','semantics'])&&name.test(p.id)&&ref.test(p.dataType)&&
  (p.direction==='input'||p.direction==='output')&&semantics.has(p.semantics),
  'invalid_genome_port');
}
function validateGraphShape(g){
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
function item(id,chromosome,ordinal,payload){
 return {id,chromosome,ordinal,payload};
}
function compileGenes(graph){
 const genes=[item('graph.header','structural',0,{
  schema:graph.schema,id:graph.id,schemaVersion:graph.schemaVersion,
  revision:graph.revision,domain:graph.domain})];
 for(let i=0;i<graph.interfacePorts.length;i++)
  genes.push(item('port.interface.'+i,'interface',i,cpy(graph.interfacePorts[i])));
 for(let i=0;i<graph.nodes.length;i++)
  genes.push(item('node.'+graph.nodes[i].id,'structural',i,cpy(graph.nodes[i])));
 for(let i=0;i<graph.edges.length;i++)
  genes.push(item('edge.'+graph.edges[i].id,'connection',i,cpy(graph.edges[i])));
 return genes;
}
function unpackGenes(genes){
 check(Array.isArray(genes)&&genes.length>=1&&genes.length<=MAX_GENES,'invalid_genome_genes');
 const used=new Set(),by={structural:[],interface:[],connection:[]};
 for(const gene of genes){
  check(keys(gene,['id','chromosome','ordinal','payload'])&&
   typeof gene.id==='string'&&gene.id.length<=256&&
   gene.chromosome in by&&int(gene.ordinal,0,MAX_GENES)&&plain(gene.payload)&&
   !used.has(gene.id),'invalid_gene');
  used.add(gene.id);by[gene.chromosome].push(gene);
 }
 const header=genes.find(g=>g.id==='graph.header');
 check(header&&header.chromosome==='structural'&&header.ordinal===0&&
  keys(header.payload,['schema','id','schemaVersion','revision','domain']),
  'missing_graph_header_gene');
 for(const g of genes){
  const expected=g.id==='graph.header'?true:
   (g.chromosome==='interface'&&g.id==='port.interface.'+g.ordinal)||
   (g.chromosome==='structural'&&g.id==='node.'+g.payload.id)||
   (g.chromosome==='connection'&&g.id==='edge.'+g.payload.id);
  check(expected,'invalid_gene_identity');
 }
 const array=group=>by[group].filter(g=>g.id!=='graph.header')
  .sort((a,b)=>a.ordinal-b.ordinal);
 for(const type of ['structural','interface','connection']){
  const a=array(type);
  check(a.every((g,i)=>g.ordinal===i),'invalid_gene_ordinal');
 }
 const h=header.payload;
 const graph={schema:h.schema,id:h.id,schemaVersion:h.schemaVersion,
  revision:h.revision,domain:h.domain,
  interfacePorts:array('interface').map(g=>cpy(g.payload)),
  nodes:array('structural').map(g=>cpy(g.payload)),
  edges:array('connection').map(g=>cpy(g.payload))};
 return validateGraphShape(graph);
}
function validGenome(genome){
 check(keys(genome,['schema','id','revision','original','acquired','experimental','originDigest'])&&
  genome.schema===GENOME_SCHEMA&&name.test(genome.id)&&
  int(genome.revision,1,Number.MAX_SAFE_INTEGER)&&
  Array.isArray(genome.original)&&Array.isArray(genome.acquired)&&
  Array.isArray(genome.experimental)&&genome.original.length<=MAX_GENES&&
  genome.acquired.length<=MAX_GENES&&genome.experimental.length<=MAX_GENES&&
  typeof genome.originDigest==='string'&&/^sha256:[0-9a-f]{64}$/.test(genome.originDigest),
  'invalid_genome_envelope');
 check(genome.acquired.length===0&&genome.experimental.length===0,'unverified_genome_layer');
 const graph=unpackGenes(genome.original);
 check(hash(graph)===genome.originDigest,'original_genome_digest_mismatch');
 return graph;
}
/** Reversible typed encoding of graph configuration, not weights/state/secrets. */
export function encodeGraphGenome(input,{genomeId='adamantium.system'}={}){
 validateGraphShape(input);check(name.test(genomeId),'invalid_genome_id');
 const graph=cpy(input);
 const genome={schema:GENOME_SCHEMA,id:genomeId,revision:1,
  original:compileGenes(graph),acquired:[],experimental:[],
  originDigest:hash(graph)};
 validGenome(genome);
 return genome;
}
export function decodeGraphGenome(genome){
 return cpy(validGenome(genome));
}
/**
 * Design-only candidate. Cannot be expressed by decodeGraphGenome.
 * Mutations never overwrite the original genome or change the live graph.
 */
export function proposeGenomeMutation(genome,{geneId,replaceWith,baseRevision}){
 const original=validGenome(genome);
 check(baseRevision===genome.revision,'stale_genome_revision');
 check(typeof geneId==='string'&&geneId!=='graph.header','protected_genome_header');
 const slot=genome.original.findIndex(g=>g.id===geneId);
 check(slot>=0,'gene_not_found');
 const source=genome.original[slot];
 // Keep stable identity, chromosome and position. Only a gene's payload may evolve.
 check(plain(replaceWith),'invalid_mutation_payload');
 const proposed=cpy(genome.original);
 proposed[slot]={...proposed[slot],payload:cpy(replaceWith)};
 const candidate=unpackGenes(proposed);
 check(candidate.id===original.id&&candidate.schema===original.schema&&
  candidate.schemaVersion===original.schemaVersion,'protected_graph_identity');
 // The experimental layer stores only a bounded delta; it is not activated.
 const delta={geneId,chromosome:source.chromosome,baseDigest:genome.originDigest,
  originalGeneDigest:hash(source.payload),candidateGeneDigest:hash(replaceWith),
  payload:cpy(replaceWith)};
 return {schema:'mechanicus.genome-proposal/1',genomeId:genome.id,
  expectedRevision:genome.revision,originalDigest:genome.originDigest,
  candidateDigest:hash(candidate),experimental:[delta],
  verifiedByCompiler:false,authorized:false,executable:false,
  requiredGates:['canonical-g0-compiler','policy','artifact-signatures',
   'isolated-tests','measured-budget','independent-review','rollback-point']};
}
/** Exact overlay simulation, requiring a matching base genome and intact delta. */
export function previewGenomeMutation(genome,proposal){
 validGenome(genome);
 check(plain(proposal)&&proposal.schema==='mechanicus.genome-proposal/1'&&
  proposal.genomeId===genome.id&&proposal.expectedRevision===genome.revision&&
  proposal.originalDigest===genome.originDigest&&Array.isArray(proposal.experimental)&&
  proposal.experimental.length===1&&proposal.authorized===false&&
  proposal.executable===false&&proposal.verifiedByCompiler===false,
  'invalid_or_stale_proposal');
 const d=proposal.experimental[0];
 check(plain(d)&&d.baseDigest===genome.originDigest&&
  typeof d.geneId==='string'&&plain(d.payload),'invalid_gene_delta');
 const slot=genome.original.findIndex(g=>g.id===d.geneId);
 check(slot>=0&&hash(genome.original[slot].payload)===d.originalGeneDigest&&
  hash(d.payload)===d.candidateGeneDigest&&
  genome.original[slot].chromosome===d.chromosome,'gene_delta_integrity_failure');
 const genes=cpy(genome.original);genes[slot].payload=cpy(d.payload);
 const graph=unpackGenes(genes);
 check(hash(graph)===proposal.candidateDigest,'candidate_genome_digest_mismatch');
 return {graph,authorized:false,executable:false,requiresIndependentValidation:true};
}
/** No runtime actions here: an expression *description* for a separate conductor. */
export function planGenomeExpression(genome){
 const graph=decodeGraphGenome(genome);
 return {graphId:graph.id,revision:graph.revision,genomeDigest:genome.originDigest,
  nodeCount:graph.nodes.length,edgeCount:graph.edges.length,
  typeReferences:[...new Set(graph.nodes.map(n=>n.kind==='composite'?
   'graph:'+n.graphRef+'@'+n.graphRefRevision:n.typeRef))].sort(),
  requiresArtifactResolution:true,requiresAuthorizedLifecycle:true,
  requiresStateRestore:true,authorized:false,executable:false};
}

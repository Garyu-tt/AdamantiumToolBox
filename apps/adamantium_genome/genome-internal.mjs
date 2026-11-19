import {MAX_GENES,check,plain,int,name,keys,cpy,hash,validateGraphShape} from './validation.mjs';
function item(id,chromosome,ordinal,payload){
 return {id,chromosome,ordinal,payload};
}
export function compileGenes(graph){
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
export function unpackGenes(genes){
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
export function validGenome(genome){
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

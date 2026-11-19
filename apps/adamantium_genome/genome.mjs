import {GRAPH_SCHEMA,GENOME_SCHEMA,MAX_GENES,check,plain,int,name,keys,cpy,hash,validateGraphShape} from './validation.mjs';
import {compileGenes,unpackGenes,validGenome} from './genome-internal.mjs';
export {GRAPH_SCHEMA,GENOME_SCHEMA,MAX_GENES};
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

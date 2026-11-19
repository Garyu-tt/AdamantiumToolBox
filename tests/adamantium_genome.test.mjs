import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_SCHEMA,GENOME_SCHEMA,encodeGraphGenome,decodeGraphGenome,
 proposeGenomeMutation,previewGenomeMutation,planGenomeExpression}
 from '../apps/adamantium_genome/genome.mjs';

import {clone,selfHostGraph,sampleNeural} from './adamantium_genome_fixtures.mjs';
test('GENESIS/Toolbox self-host graph round-trips exactly as typed chromosomes',()=>{
 for(const source of [selfHostGraph(),sampleNeural()]){
  const original=clone(source);
  const genome=encodeGraphGenome(source);
  assert.equal(genome.schema,GENOME_SCHEMA);
  assert.equal(genome.acquired.length,0);
  assert.equal(genome.experimental.length,0);
  assert.deepEqual(genome.original.map(g=>g.chromosome).filter(x=>x==='connection').length,
   source.edges.length);
  assert.deepEqual(decodeGraphGenome(clone(genome)),source);
  assert.deepEqual(source,original,'encode must not mutate live graph');
  assert.equal(planGenomeExpression(genome).authorized,false);
  assert.equal(planGenomeExpression(genome).executable,false);
 }
});
test('identity digest is independent of JSON object key insertion order',()=>{
 const source=selfHostGraph();
 const shuffled={edges:source.edges,nodes:source.nodes,interfacePorts:[],
  domain:source.domain,revision:source.revision,schemaVersion:source.schemaVersion,
  id:source.id,schema:source.schema};
 const g=encodeGraphGenome(shuffled);
 assert.deepEqual(decodeGraphGenome(g),source);
 assert.equal(g.originDigest,encodeGraphGenome(source).originDigest);
});
test('experimental mutation alters only a candidate graph, never the original',()=>{
 const genome=encodeGraphGenome(selfHostGraph());
 const before=clone(genome);
 const compilerGene=genome.original.find(g=>g.id==='node.compiler');
 const newPayload=clone(compilerGene.payload);
 newPayload.typeRef='adamantium.genome.compiler@2';
 const proposal=proposeGenomeMutation(genome,{
  geneId:'node.compiler',replaceWith:newPayload,baseRevision:genome.revision});
 assert.equal(proposal.authorized,false);
 assert.equal(proposal.verifiedByCompiler,false);
 assert.equal(proposal.executable,false);
 assert(proposal.requiredGates.includes('independent-review'));
 const preview=previewGenomeMutation(genome,clone(proposal));
 assert.equal(preview.graph.nodes[1].typeRef,'adamantium.genome.compiler@2');
 assert.equal(decodeGraphGenome(genome).nodes[1].typeRef,'adamantium.genome.compiler@1');
 assert.equal(preview.requiresIndependentValidation,true);
 assert.deepEqual(genome,before);
});

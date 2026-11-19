import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_SCHEMA,GENOME_SCHEMA,encodeGraphGenome,decodeGraphGenome,
 proposeGenomeMutation,previewGenomeMutation,planGenomeExpression}
 from '../apps/adamantium_genome/genome.mjs';

import {clone,selfHostGraph,sampleNeural} from './adamantium_genome_fixtures.mjs';
test('tampered genomes, mutation envelopes and stale revisions fail closed',()=>{
 const genome=encodeGraphGenome(selfHostGraph());
 const tampered=clone(genome);tampered.original[2].payload.typeRef='evil.unverified@1';
 assert.throws(()=>decodeGraphGenome(tampered),/original_genome_digest_mismatch/);
 const layer=clone(genome);layer.experimental=[{geneId:'fake'}];
 assert.throws(()=>decodeGraphGenome(layer),/unverified_genome_layer/);
 assert.throws(()=>proposeGenomeMutation(genome,{
  geneId:'node.compiler',replaceWith:{},baseRevision:42}),/stale_genome_revision/);
 assert.throws(()=>proposeGenomeMutation(genome,{
  geneId:'graph.header',replaceWith:{},baseRevision:1}),/protected_genome_header/);
 const altered=clone(genome.original.find(g=>g.id==='node.compiler').payload);
 altered.typeRef='adamantium.genome.compiler@2';
 const proposal=proposeGenomeMutation(genome,{
  geneId:'node.compiler',replaceWith:altered,baseRevision:1});
 proposal.experimental[0].payload.typeRef='adamantium.genome.compiler@99';
 assert.throws(()=>previewGenomeMutation(genome,proposal),/gene_delta_integrity_failure/);
});
test('typed domain isolation rejects permissions as data and orphan targets',()=>{
 const broken=sampleNeural();broken.edges[0].semantics='permission';
 assert.throws(()=>encodeGraphGenome(broken),/invalid_edge_contract/);
 const orphan=selfHostGraph();orphan.edges[0].toNode='missing';
 assert.throws(()=>encodeGraphGenome(orphan),/invalid_edge_contract/);
 const wrong=selfHostGraph();wrong.nodes[1].typeRef='not.versioned';
 assert.throws(()=>encodeGraphGenome(wrong),/invalid_type_ref/);
});
test('verified gene mapping rejects reordering attacks, duplicate IDs and malformed genes',()=>{
 const genome=encodeGraphGenome(sampleNeural());
 const change=clone(genome);change.original.find(g=>g.id==='edge.forward').ordinal=1;
 assert.throws(()=>decodeGraphGenome(change),/invalid_gene_ordinal/);
 const duplicated=clone(genome);duplicated.original.push(clone(duplicated.original[1]));
 assert.throws(()=>decodeGraphGenome(duplicated),/invalid_gene/);
 const broken=clone(genome);broken.original.find(g=>g.id==='node.vision').id='node.other';
 assert.throws(()=>decodeGraphGenome(broken),/invalid_gene_identity/);
});

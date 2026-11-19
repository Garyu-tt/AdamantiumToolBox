import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_SCHEMA,GENOME_SCHEMA,encodeGraphGenome,decodeGraphGenome,
 proposeGenomeMutation,previewGenomeMutation,planGenomeExpression}
 from '../apps/adamantium_genome/genome.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const port=(id,dataType,direction,semantics='data')=>
 ({id,dataType,direction,semantics});
const node=(id,kind,typeRef,ports)=>({
 id,kind,typeRef,graphRef:'',ports,graphRefRevision:0
});
const edge=(id,fromNode,fromPort,toNode,toPort,semantics='data',delayTicks=0)=>
 ({id,fromNode,fromPort,toNode,toPort,semantics,delayTicks});
function selfHostGraph(){
 const genome=node('genome','resource','adamantium.genome.store@1',[
  port('ref','genome.ref@1','output')]);
 const compiler=node('compiler','capability','adamantium.genome.compiler@1',[
  port('source','genome.ref@1','input'),
  port('graph','graph.ref@1','output')]);
 const verifier=node('verifier','capability','mechanicus.graph.verify@1',[
  port('graph','graph.ref@1','input'),
  port('result','verification.receipt@1','output')]);
 const candidate=node('candidate','capability','mechanicus.lifecycle.proposal@1',[
  port('receipt','verification.receipt@1','input')]);
 return {schema:GRAPH_SCHEMA,id:'adamantium.selfhost',schemaVersion:1,
  revision:4,domain:'program',interfacePorts:[],
  nodes:[genome,compiler,verifier,candidate],
  edges:[edge('decode','genome','ref','compiler','source'),
   edge('verify','compiler','graph','verifier','graph'),
   edge('propose','verifier','result','candidate','receipt')]};
}
function sampleNeural(){
 return {schema:GRAPH_SCHEMA,id:'genesis.brain',schemaVersion:1,
  revision:2,domain:'neural',interfacePorts:[],
  nodes:[
   node('vision','brain-region','genesis.region@1',[
    port('signal_in','neural.spike@1','input','signal'),
    port('signal_out','neural.spike@1','output','signal')]),
   node('association','brain-region','genesis.region@1',[
    port('signal_in','neural.spike@1','input','signal'),
    port('signal_out','neural.spike@1','output','signal')])],
  edges:[edge('forward','vision','signal_out','association','signal_in','signal'),
   edge('feedback','association','signal_out','vision','signal_in','signal',1)]};
}
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

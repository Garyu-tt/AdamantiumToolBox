import test from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {examples} from '../src/demo.ts';

const schema=JSON.parse(await readFile(
  new URL('../../../standards/universal-graph/graph-ir-v1.schema.json',import.meta.url),
  'utf8'));
const ajv=new Ajv2020({strict:true,allErrors:true});
const validate=ajv.compile(schema);

test('same canonical schema for MAS/GENESIS/Dante',()=>{
  assert.deepEqual(Object.keys(examples).sort(),['brain','genesis','program','selfhost']);
  for(const [name,graph] of Object.entries(examples))
    assert.ok(validate(graph),name+': '+JSON.stringify(validate.errors));
});
test('GENESIS self-host graph is only a typed proposal chain',()=>{
 const g=examples.selfhost;
 assert.equal(g.domain,'program');
 assert.equal(g.nodes.length,6);
 assert.equal(g.edges.length,5);
 assert.ok(g.nodes.some(n=>n.typeRef==='adamantium.genome.compiler@1'));
 assert.ok(g.nodes.some(n=>n.typeRef==='mechanicus.lifecycle.proposal@1'));
 assert.ok(g.edges.every(e=>e.semantics==='data'&&e.delayTicks===0));
 assert.ok(validate(g),JSON.stringify(validate.errors));
});
test('no execution authority is embedded in the projection',()=>{
  for(const graph of Object.values(examples)){
    assert.equal(Object.hasOwn(graph,'authorized'),false);
    assert.equal(Object.hasOwn(graph,'executable'),false);
    assert.ok(graph.nodes.every(n=>!Object.hasOwn(n,'credentials')));
  }
});
test('schema rejects implicit authority or missing version pin',()=>{
  const source=structuredClone(examples.genesis);
  source.nodes[0].owner='admin';
  assert.equal(validate(source),false);
  const wrong=structuredClone(examples.program);
  wrong.nodes[0].typeRef='unversioned';
  assert.equal(validate(wrong),false);
  const noRevision=structuredClone(examples.brain);
  delete noRevision.revision;
  assert.equal(validate(noRevision),false);
});
test('brain feedback has an explicit delay, policy links are not dataflow',()=>{
  const brain=examples.brain;
  assert.ok(brain.edges.some(e=>e.semantics==='signal'&&e.delayTicks>0));
  assert.ok(!brain.edges.some(e=>e.semantics==='permission'));
});

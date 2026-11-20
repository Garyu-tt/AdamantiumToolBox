import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkDeterministicCorpus} from '../tools/math-lab-benchmark.mjs';

test('synthetic benchmark reports reproducible input identities, truthful winners and negative cases',()=>{
 const report=benchmarkDeterministicCorpus();
 assert.equal(report.schema,'mechanicus.math-benchmark/1');
 assert.equal(report.corpusCount,8);
 assert.equal(report.productionApproved,false);
 assert.equal(report.independentQA,'not-performed');
 const ids=new Set();
 for(const item of report.results){
  assert.ok(!ids.has(item.id));
  ids.add(item.id);
  assert.match(item.sha256,/^[a-f0-9]{64}$/);
  assert.ok(item.bytes>0&&item.bytes<=8192);
  assert.equal(item.methods[0].bytes,Math.min(...item.methods.map(m=>m.bytes)));
  assert.equal(item.best,item.methods[0].method);
  assert.ok(item.bestBytes<=item.bytes);
  assert.ok(item.exploredStates<=24);
  assert.ok(item.rootCalls<=4);
  assert.notEqual(item.independentAgentReviewed,true);
  if(item.graphChosenWithoutBrotli)assert.equal(item.graphReproduced,true);
 }
 const byName=new Map(report.results.map(x=>[x.id,x]));
 assert.equal(byName.get('integer.decimal_power').bytes,416);
 assert.equal(byName.get('integer.binary_power').bytes,513);
 assert.equal(byName.get('bytes.uniform_prng').bytes,1024);
 assert.ok(byName.get('bytes.uniform_prng').bestBytes>0);
 // A negative case is an empirical result, not a failed benchmark.
 assert.ok(byName.get('text.decimal_power').methods.some(x=>x.method==='brotli-q9'));
});

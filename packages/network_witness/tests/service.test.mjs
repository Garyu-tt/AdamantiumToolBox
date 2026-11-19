import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {launch} from './http-fixture.mjs';
import {ORIGIN} from '../lib/contract.mjs';
test('authenticated HTTP graph, checkpoint, inspect and no apply action',async()=>{
 const f=await launch();try{
  assert.equal((await f.request('/graph',null,'wrong')).status,401);
  const graph=await f.request('/graph');
  assert.equal(graph.body.nodes.filter(x=>x.type==='action').length,5);
  assert(graph.body.nodes.some(x=>x.id==='network_witness.latest'));
  const genesis=await f.request('/invoke',{action:'network_witness.latest',params:{journalId:'approval'}});
  assert.equal(genesis.body.result.latest,null);
  const a=f.segment();const x=await f.request('/invoke',{action:'network_witness.anchor',params:{...a,expectedRevision:ORIGIN}});
  assert.equal(x.status,200,JSON.stringify(x.body));
  const i=await f.request('/invoke',{action:'network_witness.inspect',params:a});
  assert.equal(i.body.result.state,'matches_witness');
  const latest=await f.request('/invoke',{action:'network_witness.latest',params:{journalId:'approval'}});
  assert.equal(latest.body.result.latest.receipt.ledgerSeq,1);
  const untrusted=await f.request('/invoke',{action:'network_witness.latest',params:{journalId:'untrusted'}});
  assert.equal(untrusted.status,400);
  const unknown=await f.request('/invoke',{action:'network_witness.apply',params:{}});
  assert.equal(unknown.status,403);
 }finally{await f.shutdown();}
});
test('corrupted disk withdraws write capability from graph and rejects anchor',async()=>{
 const f=await launch();try{const a=f.segment();await f.request('/invoke',{action:'network_witness.anchor',params:{...a,expectedRevision:ORIGIN}});
  let raw=await readFile(f.logPath,'utf8');await writeFile(f.logPath,raw.replace('approval','another'));
  const g=await f.request('/graph');assert(g.body.nodes.every(x=>x.id!=='network_witness.anchor'));
  const denied=await f.request('/invoke',{action:'network_witness.anchor',params:{...a,expectedRevision:ORIGIN}});
  assert.equal(denied.status,403);
  const status=await f.request('/invoke',{action:'network_witness.status'});
  assert.equal(status.body.result.configured,false);
 }finally{await f.shutdown();}
});

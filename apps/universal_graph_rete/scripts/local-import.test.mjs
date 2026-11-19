import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLocalGraph,MAX_LOCAL_GRAPH_BYTES} from '../src/local_import.ts';
import {examples} from '../src/demo.ts';

const verify=candidate=>{
 if(!candidate||candidate.schema!=='mechanicus.universal-graph/1')
  throw Error('invalid_g0_shape');
 return candidate;
};
const file=x=>({size:Buffer.byteLength(x),text:async()=>x});
test('reads local G0 JSON unchanged, never calls an executor',async()=>{
 const raw=JSON.stringify(examples.genesis);
 const graph=await parseLocalGraph(file(raw),verify);
 assert.deepEqual(graph,examples.genesis);
 assert.equal(graph.domain,'genesis');
 assert.equal(graph.edges.length,3);
});
test('reject oversized file before reading any bytes',async()=>{
 let read=false;
 await assert.rejects(()=>parseLocalGraph({size:MAX_LOCAL_GRAPH_BYTES+1,text:async()=>{
  read=true;return '{}';
 }},verify),/local_graph_file_budget/);
 assert.equal(read,false);
});
test('reject file lying about length and invalid JSON syntax',async()=>{
 const raw=JSON.stringify(examples.program);
 await assert.rejects(()=>parseLocalGraph({size:1,text:async()=>raw+' '.repeat(MAX_LOCAL_GRAPH_BYTES)},verify),
  /local_graph_file_budget/);
 await assert.rejects(()=>parseLocalGraph(file('{bad'),verify),SyntaxError);
});
test('invalid schema is rejected; empty or unreadable candidates are rejected',async()=>{
 await assert.rejects(()=>parseLocalGraph(file(JSON.stringify({schema:'evil'})),verify),
  /invalid_g0_shape/);
 await assert.rejects(()=>parseLocalGraph(null,verify),/local_graph_file_budget/);
 await assert.rejects(()=>parseLocalGraph({size:3},verify),/invalid_local_graph_file/);
});

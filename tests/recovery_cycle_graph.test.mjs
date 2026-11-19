import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const path=fileURLToPath(new URL('../docs/RECURSIVE-RECOVERY-CYCLE-R01.graph.json',import.meta.url));
const graph=JSON.parse(await readFile(path,'utf8'));
assert.equal(graph.schema,'mechanicus.recovery.control-graph.v1');
assert.equal(graph.terminal_blocked_allowed,false);

const ids=graph.nodes.map(n=>n.id), unique=new Set(ids);
assert.equal(ids.length,unique.size,'duplicate control nodes');
assert(unique.has(graph.required_root),'missing observation root');
assert(!unique.has('blocked'),'BLOCKED must not be a terminal state');
for(const e of graph.edges){
 assert(unique.has(e.from)&&unique.has(e.to),'unbound control edge');
 assert(e.event&&typeof e.event==='string','every transition needs a typed event');
}
for(const start of ids){
 const seen=new Set([start]),queue=[start];
 while(queue.length){
  const cur=queue.shift();
  for(const e of graph.edges.filter(x=>x.from===cur)){
   if(!seen.has(e.to)){seen.add(e.to);queue.push(e.to);}
  }
 }
 assert.equal(seen.size,ids.length,start+' has a terminal path / cannot return through the complete cycle');
}
for(const required of ['decompose','provider_branch','fix_branch','rollback','test','integrate','readback','wait_trigger']){
 assert(unique.has(required),'missing recovery transition '+required);
}
assert(graph.edges.some(e=>e.from==='wait_trigger'&&e.to==='observe'),'waiting must resume on a trigger');
assert(graph.edges.some(e=>e.from==='readback'&&e.to==='incident'),'regressions must reopen root incident');
console.log('RECOVERY_CONTROL_GRAPH_OK',ids.length,graph.edges.length);

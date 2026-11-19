import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {emptyContext,eventId,validateContext} from '../apps/genintegrate/contract.mjs';
import {integrate} from '../apps/genintegrate/reducer.mjs';
const event=(n,source='world.mock',kind='position',value=n)=>({
 schema:'genesis.sensory.normalized.v1',source,kind,sequence:n,observedAtMs:n,traceId:'trace.test',
 unit:'raw',signals:{position:value,target:12},
 payloadSha256:createHash('sha256').update(JSON.stringify({position:value,target:12})).digest('hex')
});
test('immutable CPU temporal integration, summaries and replay',()=>{
 const original=emptyContext(),e0=event(0);
 const first=integrate({context:original,event:e0});
 assert.equal(first.status,'integrated');assert.equal(first.context.count,1);
 assert.equal(original.count,0,'input must not mutate');assert.equal(first.eventId,eventId(e0));
 assert.equal(first.summary.signals.position.last,0);
 assert.equal(first.summary.signals.position.count,1);
 const second=integrate({context:first.context,event:event(1)});
 assert.equal(second.context.count,2);assert.equal(second.summary.signals.position.mean,0.5);
 assert.equal(second.summary.signals.position.max,1);
 const dup=integrate({context:second.context,event:event(1)});
 assert.equal(dup.status,'duplicate');assert.deepEqual(dup.context,second.context);
 assert.notEqual(dup.context,second.context,'return independent snapshot');
 assert.equal(dup.eventId,eventId(event(1)));
});
test('fails closed on gaps, conflicting payloads, invalid contexts',()=>{
 const first=integrate({event:event(8)}).context;
 assert.throws(()=>integrate({context:first,event:event(10)}),/sequence_gap/);
 assert.throws(()=>integrate({context:first,event:event(7)}),/sequence_regression/);
 assert.throws(()=>integrate({context:first,event:event(8,'world.mock','position',5)}),/sequence_conflict/);
 assert.throws(()=>integrate({context:{...first,count:0},event:event(9)}),/invalid_context/);
 assert.throws(()=>integrate({context:{...first,cursors:[{...first.cursors[0],eventId:'f'.repeat(64)}]},event:event(9)}),/invalid_cursor/);
 assert.throws(()=>integrate({context:first,event:{...event(9),signals:{position:Infinity}}}),/invalid_signal_values/);
});
test('bounded history, sources, independent signal streams',()=>{
 let context=null;
 for(let i=0;i<10;i++)context=integrate({context,event:event(i),maxRecent:3}).context;
 assert.equal(context.count,10);assert.equal(context.recent.length,3);
 const x=integrate({context,event:event(0,'another.source','position',100),maxRecent:3,maxSources:2});
 assert.equal(x.context.cursors.length,2);
 assert.equal(x.summary.signals.position.last,100);
 assert.equal(x.summary.events,1);
 assert.throws(()=>integrate({context:x.context,event:event(0,'third.source'),maxRecent:3,maxSources:2}),/source_limit/);
 assert.throws(()=>integrate({context:x.context,event:event(1),maxRecent:2,maxSources:2}),/invalid_context/);
 validateContext(x.context,{maxRecent:3,maxSources:2});
});
test('rejects malicious event, forged cursor, extreme values remain finite',()=>{
 const e=event(0);
 assert.throws(()=>integrate({event:{...e,signals:JSON.parse('{"__proto__":1}')}}),/invalid_signal_values/);
 assert.throws(()=>integrate({event:{...e,payloadSha256:'untrusted'}}),/invalid_normalized_event/);
 let context=integrate({event:event(0,'extreme','position',Number.MAX_VALUE)}).context;
 const result=integrate({context,event:event(1,'extreme','position',-Number.MAX_VALUE)});
 assert(Number.isFinite(result.summary.signals.position.mean));
 const second=integrate({event:event(0,'positive','position',Number.MAX_VALUE)}).context;
 const positive=integrate({context:second,event:event(1,'positive','position',Number.MAX_VALUE)});
 assert(Number.isFinite(positive.summary.signals.position.mean));
});

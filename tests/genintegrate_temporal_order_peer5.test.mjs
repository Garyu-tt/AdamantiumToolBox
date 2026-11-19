import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {validateContext, eventId, CONTEXT_SCHEMA, EVENT_SCHEMA} from '../apps/genintegrate/contract.mjs';

const event=(sequence,source='world.mock')=>({
 schema:EVENT_SCHEMA,source,kind:'position',sequence,observedAtMs:sequence,
 traceId:null,signals:{position:sequence},unit:'raw',
 payloadSha256:createHash('sha256').update(String(sequence)).digest('hex')
});
const cursor=e=>({source:e.source,kind:e.kind,sequence:e.sequence,
 payloadSha256:e.payloadSha256,eventId:eventId(e)});

test('rejects reversed temporal order within one stream',()=>{
 const a=event(0),b=event(1);
 const context={schema:CONTEXT_SCHEMA,count:2,cursors:[cursor(b)],recent:[b,a]};
 assert.throws(()=>validateContext(context),/recent_order|temporal_order|sequence_order|invalid_context/,
   'same-stream recent sequence must increase strictly in append order');
});

test('allows interleaving independent streams in append order',()=>{
 const a0=event(0,'world.a'),b0=event(0,'world.b'),a1=event(1,'world.a');
 const context={schema:CONTEXT_SCHEMA,count:3,cursors:[cursor(a1),cursor(b0)],
  recent:[a0,b0,a1]};
 assert.doesNotThrow(()=>validateContext(context));
});

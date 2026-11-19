import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {sign} from 'node:crypto';
import {Witness} from '../../network_witness/lib/store.mjs';
import {sourceBytes} from '../../network_witness/lib/contract.mjs';
import {fixture} from './fixture.mjs';
import {openAnchor} from '../lib/store.mjs';
import {ORIGIN,sha} from '../lib/contract.mjs';
test('real Witness signed receipt notarized by independent Anchor without runtime dependency',async()=>{
 const f=await fixture(),path=join(f.home,'witness.log');let w,anchor;
 const witnessTrust={schema:'network-witness-trust-v1',
  witness:f.trust.witness,sources:f.trust.sources};
 try{
  w=await new Witness(path,witnessTrust,f.keys.witness.privateKey).start();
  const event={type:'propose',test:'isolated'},row={seq:1,previous:ORIGIN,event};
  row.hash=sha(JSON.stringify({seq:1,previous:ORIGIN,event}));
  const checkpoint={schema:'network-approval-checkpoint-v1',journalId:'approval',seq:1,
   head:row.hash,keyId:'source-key',at:new Date().toISOString()};
  const signature=sign(null,sourceBytes(checkpoint),f.keys.source.privateKey).toString('base64');
  const witnessed=await w.anchor({checkpoint,signature,segment:[row],expectedRevision:ORIGIN});
  anchor=await openAnchor({logPath:f.logPath,trustPath:f.trustPath,keyPath:f.keyPath});
  const proof=await anchor.commit({batch:[witnessed],expectedRevision:ORIGIN});
  assert.equal(proof.attestation.witnessHead,witnessed.witnessRevision);
  assert.equal(anchor.inspect(witnessed).state,'matches_anchor');
  assert(!JSON.stringify(anchor.latest()).includes('test:isolated'));
 }finally{await Promise.all([w?.close(),anchor?.close()]);await f.remove();}
});

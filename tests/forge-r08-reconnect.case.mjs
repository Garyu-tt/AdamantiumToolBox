import {strict as assert} from 'node:assert';
export async function testReconnect({planReconnect}){
 const last={stream_id:'sample-stream',sequence:10,graph_revision:'g-10',
  policy_revision:'p-4',identity_revision:'i-4',ui_revision:'ui-4'};
 const event=(sequence,kind,base,graph)=>({id:'event-'+sequence,sequence,kind,
  receipt_ref:'receipt-'+sequence,base_revision:base,graph_revision:graph,
  policy_revision:last.policy_revision,identity_revision:last.identity_revision});
 const current={...last,sequence:12,graph_revision:'g-12',ui_revision:'ui-12'};
 const events=[event(11,'publication.committed','g-10','g-11'),
  event(12,'ui.mount.changed','g-11','g-12')];
 const base={schema:'forge.projection.reconnect.request.v1',request_id:'reconnect-1',
  client_ref:'sample.client',principal_ref:'sample-principal',last,current,events};
 const good=planReconnect(base);
 assert.equal(good.ok,true);assert.equal(good.mode,'replay_candidate');
 assert.equal(good.invalidate_cached_actions,true);
 assert(good.steps.every(x=>x.executable===false&&x.authorized===false));
 assert.equal(good.reconnected,false);assert.equal(good.can_execute,false);
 const unchanged=planReconnect({...base,current:last,events:[]});
 assert.equal(unchanged.mode,'reauthorize_and_readback');
 const uiDrift=planReconnect({...base,current:{...last,ui_revision:'ui-5'},events:[]});
 assert.equal(uiDrift.mode,'full_resnapshot_required');
 assert(uiDrift.issues.some(x=>x.code==='UI_REVISION_DRIFT'));
 const gap=planReconnect({...base,events:events.slice(1)});
 assert.equal(gap.mode,'full_resnapshot_required');
 assert(gap.issues.some(x=>x.code==='REPLAY_GAP'));
 const security=planReconnect({...base,current:{...current,policy_revision:'p-5'}});
 assert.equal(security.mode,'full_resnapshot_required');
 assert(security.issues.some(x=>x.code==='SECURITY_EPOCH_CHANGED'));
 const revocation=planReconnect({...base,events:[events[0],
  event(12,'capability.revoked','g-11','g-12')]});
 assert.equal(revocation.mode,'full_resnapshot_required');
 const fork=planReconnect({...base,events:[events[0],
  {...events[1],base_revision:'g-7'}]});
 assert.equal(fork.mode,'full_resnapshot_required');
 const duplicate=planReconnect({...base,events:[events[0],
  {...events[1],id:events[0].id}]});
 assert.equal(duplicate.mode,'full_resnapshot_required');
 const rewind=planReconnect({...base,current:{...last,sequence:9},events:[]});
 assert.equal(rewind.mode,'full_resnapshot_required');
 const bad=planReconnect({...base,events:null});
 assert.equal(bad.ok,false);
 for(const x of [gap,security,revocation,fork,rewind,bad])
  for(const i of x.issues)assert(i.reason&&i.evidence?.path&&i.remedies?.length);
}

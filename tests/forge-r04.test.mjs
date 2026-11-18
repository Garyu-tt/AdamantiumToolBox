import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {negotiateProviders} from '../apps/forge/negotiation.mjs';
import {prepareIntegration,assessVisibility} from '../apps/forge/integration.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fn=JSON.parse(await readFile(resolve(root,'apps/forge/example.function.json'),'utf8'));
const now=Date.now();
const input={function:fn,request_id:'forge-r04-req-0001',expected_revision:'graph-81'};
const snapshot={schema:'forge.provider.snapshot.v1',source:'host-discovery',revision:'discovery-91',
 policy_revision:'policy-42',observed_at:new Date(now-2000).toISOString(),
 expires_at:new Date(now+60000).toISOString(),capabilities:[]};
const preview=negotiateProviders({flow:'publication',input,snapshot},now);
const offers=preview.selections.map((s,i)=>({contract:s.contract,contract_version:'1.0.0',
 provider_ref:`provider${i}`,node_ref:`host${i}`,action_id:`provider${i}.invoke`,
 status:'reachable',can_invoke:true,identity_pinned:true,policy_allowed:true,
 primary:s.mode==='write',access:[s.mode]}));
const call={schema:'forge.integration.request.v1',flow:'publication',input,
 snapshot:{...snapshot,capabilities:offers}};
const prepared=prepareIntegration(call,now);
assert.equal(prepared.ok,true);
assert.equal(prepared.intents.length,preview.selections.length);
assert.equal(prepared.executed,false);
assert.equal(prepared.authorized,false);
assert.equal(prepared.provider_bound,false);
assert.equal(prepared.can_execute,false);
assert.equal(prepared.intents[0].request_id,input.request_id);
assert.equal(prepared.intents[0].revision_precondition,input.expected_revision);
assert(prepared.intents.every(x=>x.requires_host_identity_check&&x.requires_host_policy_check));
assert(prepared.intents.every((x,i)=>x.order===i&&x.executed===false));
assert.equal(prepareIntegration({...call,input:{...input,expected_revision:undefined}},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:[]}},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:offers,
 expires_at:new Date(now-1).toISOString()}},now).ok,false);
assert.equal(prepareIntegration({...call,schema:'unsupported'},now).ok,false);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:offers.map(x=>({...x,
 identity_pinned:false}))}},now).ok,false);
const write=offers.find(x=>x.primary);
assert.equal(prepareIntegration({...call,snapshot:{...snapshot,capabilities:[...offers,
 {...write,provider_ref:'surprise',node_ref:'surprise'}]}},now).ok,false);
const reconInput={function_ref:fn.id,trigger:'provider.revoked',observed_revision:'graph-82'};
const reconBase={schema:'forge.integration.request.v1',flow:'reconciliation',input:reconInput,
 request_id:'forge-r04-recon-0001',snapshot};
const reconPreview=negotiateProviders({flow:'reconciliation',input:reconInput,snapshot},now);
const reconOffers=reconPreview.selections.map((s,i)=>({contract:s.contract,
 contract_version:'1.0.0',provider_ref:`recon${i}`,node_ref:`hostrecon${i}`,
 action_id:`recon${i}.invoke`,status:'reachable',can_invoke:true,
 identity_pinned:true,policy_allowed:true,primary:s.mode==='write',access:[s.mode]}));
const recon=prepareIntegration({...reconBase,snapshot:{...snapshot,capabilities:reconOffers}},now);
assert.equal(recon.ok,true);
assert.equal(recon.intents[0].revision_precondition,'graph-82');
assert.equal(prepareIntegration({...reconBase,request_id:undefined,
 snapshot:{...snapshot,capabilities:reconOffers}},now).ok,false);
const host={policy_revision:'policy-42',discovery_revision:'discovery-91',identity_ref:'approved-mesh-id',
 observed_at:new Date(now-1000).toISOString(),expires_at:new Date(now+30000).toISOString()};
const commit={request_id:input.request_id,function_ref:fn.id,base_revision:input.expected_revision,
 committed_revision:'graph-82',policy_revision:host.policy_revision,
 transaction_ref:'txn-82',verification_ref:'evidence-82',status:'committed'};
const evidence={host,commit,execution:{status:'succeeded',executor_ref:'worker-1',
 request_id:input.request_id,function_ref:fn.id},
 verification:{status:'accepted',evidence_ref:'evidence-82',verifier_ref:'verifier-1',
 request_id:input.request_id,function_ref:fn.id},
 capability:{function_ref:fn.id,revision:'graph-82',action:fn.capability.action,
 readback_ref:'cap-read-82',policy_revision:host.policy_revision,available:true},
 ui:{function_ref:fn.id,revision:'graph-82',action:fn.capability.action,
 contribution_ref:`ui:${fn.id}`,readback_ref:'ui-read-82',
 policy_revision:host.policy_revision,visible:true}};
const request={schema:'forge.visibility.assessment.request.v1',mode:'publish',
 request_id:input.request_id,function_ref:fn.id,capability_action:fn.capability.action,
 expected_revision:input.expected_revision,evidence};
const check=assessVisibility(request,now);
assert.equal(check.ok,true);assert.equal(check.structurally_consistent,true);
assert.equal(check.authoritative,false);assert.equal(check.ui_visible,false);
assert.equal(check.can_execute,false);
assert(check.required_host_checks.some(x=>x.includes('signatures')));
const bad=e=>assessVisibility({...request,evidence:e},now);
assert.equal(bad({...evidence,ui:{...evidence.ui,revision:'graph-999'}}).ok,false);
assert.equal(bad({...evidence,host:{...host,policy_revision:'policy-old'}}).ok,false);
assert.equal(bad({...evidence,commit:{...commit,status:'pending'}}).ok,false);
assert.equal(bad({...evidence,verification:{...evidence.verification,
 verifier_ref:evidence.execution.executor_ref}}).ok,false);
assert.equal(bad({...evidence,verification:{...evidence.verification,
 evidence_ref:'wrong-proof'}}).ok,false);
assert.equal(bad({...evidence,capability:{...evidence.capability,
 available:false}}).ok,false);
assert.equal(bad({...evidence,host:{...host,expires_at:new Date(now-1).toISOString()}}).ok,false);
assert.equal(bad({...evidence,ui:{...evidence.ui,visible:false}}).ok,false);
// A deliberately headless capability is published without an invented UI control.
const hiddenEvidence={...evidence,ui:undefined};
const hidden=assessVisibility({...request,ui_exposed:false,evidence:hiddenEvidence},now);
assert.equal(hidden.ok,true);assert.equal(hidden.ui_exposed,false);
assert.equal(assessVisibility({...request,ui_exposed:false,evidence:{...evidence,
 ui:{...evidence.ui,visible:true}}},now).ok,false);

assert(bad({...evidence,ui:{...evidence.ui,visible:false}}).issues.every(x=>
 x.reason&&x.evidence&&x.impact&&x.remedies.length));
const revoke=assessVisibility({...request,mode:'revoke',
 evidence:{...evidence,commit:{...commit,status:'revoked',cause_ref:'incident-42'},
 capability:{...evidence.capability,available:false},ui:{...evidence.ui,visible:false}}},now);
assert.equal(revoke.ok,true);assert.equal(revoke.ui_visible,false);
assert.equal(assessVisibility({...request,mode:'revoke',evidence:{...evidence,
 commit:{...commit,status:'revoked',cause_ref:'incident-42'}}},now).ok,false);
// No client assertion (even "authorized:true") can turn receipt checking into real publication.
assert.equal(assessVisibility({...request,authorized:true,ui_visible:true},now).authoritative,false);
const free=()=>new Promise(done=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>done(port));});});
const port=await free(),secret='forge-r04-strong-host-test-key';
const child=spawn(process.execPath,[resolve(root,'apps/forge/service.mjs')],{env:{...process.env,
 ADA_INTERNAL_KEY:secret,ADA_CAPS:'forge.read,forge.validate',APP_PORT:String(port)},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const query=(route,body,auth=true)=>fetch(base+route,{method:body?'POST':'GET',
 headers:{...(auth?{'x-internal-key':secret}:{}),'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2000)});
try{
 let ready=false;
 for(let i=0;i<40;i++){
  try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,50));
 }
 assert(ready,'R04 isolated Forge must launch');
 const g=await (await query('/graph')).json();
 assert(g.nodes.some(x=>x.id==='forge.integration.prepare'));
 assert(g.nodes.some(x=>x.id==='forge.visibility.assess'));
 const p=await (await query('/invoke',{action:'forge.integration.prepare',params:call})).json();
 assert.equal(p.result.ok,true);assert.equal(p.result.provider_bound,false);
 const v=await (await query('/invoke',{action:'forge.visibility.assess',params:request})).json();
 assert.equal(v.result.structurally_consistent,true);assert.equal(v.result.ui_visible,false);
 assert.equal((await query('/invoke',{action:'forge.visibility.assess',params:request},false)).status,401);
 const desc=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(desc.result.schema,'mechanicus.forge.adapter.v4');
 assert.equal(desc.result.stores_state,false);assert.equal(desc.result.external_effects,false);
 console.log('FORGE_R04_TEST_OK: dispatch intent, revision/policy coherence, publish/revoke receipts, fail-closed HTTP');
}finally{child.kill();}

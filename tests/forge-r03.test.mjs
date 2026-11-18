import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {negotiateProviders} from '../apps/forge/negotiation.mjs';
import {projectEvents} from '../apps/forge/events.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fn=JSON.parse(await readFile(resolve(root,'apps/forge/example.function.json'),'utf8'));
const input={function:fn,request_id:'request-r03-00001',expected_revision:'graph-rev-7'};
const now=Date.now();
const snap={schema:'forge.provider.snapshot.v1',revision:'snapshot-7',policy_revision:'policy-11',
 source:'host-runtime',observed_at:new Date(now-1000).toISOString(),
 expires_at:new Date(now+30000).toISOString(),capabilities:[]};
const flow={flow:'publication',input,snapshot:snap};
const missing=negotiateProviders(flow,now);
assert.equal(missing.ok,true);assert.equal(missing.complete,false);
assert.equal(missing.provider_bound,false);
assert(missing.issues.length>1);
assert(missing.issues.every(x=>x.reason&&x.evidence&&x.impact&&x.remedies.length));
const offers=missing.selections.map(({contract,mode},i)=>({provider_ref:`plug${i}`,
 node_ref:`node${i}`,action_id:`svc${i}.invoke`,contract,contract_version:'1.0.0',
 status:'reachable',can_invoke:true,identity_pinned:true,policy_allowed:true,
 primary:mode==='write',access:[mode]}));
const ready=negotiateProviders({...flow,snapshot:{...snap,capabilities:offers}},now);
assert.equal(ready.ok,true);assert.equal(ready.complete,true);
assert.equal(ready.can_execute,false);assert.equal(ready.authoritative,false);
assert(ready.selections.every(x=>x.proposed&&x.authorized===false));
assert(ready.preflight.never_automatic_write_failover);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:offers.map(x=>({
 ...x,identity_pinned:false}))}},now).complete,false);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:offers.map(x=>({
 ...x,policy_allowed:false}))}},now).complete,false);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:offers.map(x=>({
 ...x,status:'read_only_standby'}))}},now).complete,false);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:offers.map(x=>({
 ...x,contract_version:'2.0.0'}))}},now).complete,false);
const twoWrite=offers.find(x=>x.primary);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:[...offers,
 {...twoWrite,provider_ref:'other',node_ref:'other'}]}},now).complete,false);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,expires_at:new Date(now-1).toISOString(),
 capabilities:offers}},now).ok,false);
assert.equal(negotiateProviders({...flow,snapshot:{...snap,capabilities:[{random:true}]}},now).ok,false);
assert.equal(negotiateProviders({flow:'publication',input:{},snapshot:snap},now).ok,false);
const reconcile=negotiateProviders({flow:'reconciliation',input:{function_ref:fn.id,
 trigger:'provider.revoked',observed_revision:'rev-8'},snapshot:snap},now);
assert.equal(reconcile.ok,true);assert(reconcile.selections.some(x=>x.contract==='ui.contribution.revoke'));
assert.equal(reconcile.complete,false);
const cursor={stream_id:'changes',sequence:10,revision:'rev-10'};
const event=(sequence,type='dependency.changed')=>({schema:'forge.event.v1',
 id:`event-${sequence}`,sequence,type,function_ref:fn.id,observed_revision:`rev-${sequence}`});
const batch={schema:'forge.events.batch.v1',stream_id:'changes',cursor,
 events:[event(11),event(12,'function.verified'),{...event(13,'function.published'),commit_ref:'commit-13'}]};
const projection=projectEvents(batch);
assert.equal(projection.ok,true);assert.equal(projection.actions.length,3);
assert.equal(projection.proposed_cursor.sequence,13);
assert.equal(projection.cursor_committed,false);assert.equal(projection.executed,false);
assert.equal(projection.actions[0].operation,'reconcile');
assert.equal(projection.actions[1].operation,'inspect_publication');
assert.equal(projection.actions[2].operation,'refresh_ui');
assert.equal(projectEvents({...batch,events:[event(12)]}).ok,false);
assert(projectEvents({...batch,events:[event(12)]}).errors.some(x=>x.code==='EVENT_GAP'));
assert.equal(projectEvents({...batch,events:[event(10)]}).ok,false);
assert.equal(projectEvents({...batch,events:[event(11),event(11)]}).ok,false);
assert.equal(projectEvents({...batch,events:[event(11),event(12,'function.published')]}).ok,false);
const incident={incident_id:'inc-13',node_ref:fn.id,cause:{code:'NO_CAP',explanation:'No host capability'},
 evidence:[{ref:'diagnostic:13'}],impact:{direct:[fn.id]},remedies:[{action:'refresh discovery',risk:'safe'}]};
assert.equal(projectEvents({...batch,events:[{...event(11,'incident.detected'),incident}]}).ok,true);
assert.equal(projectEvents({...batch,events:[event(11,'incident.detected')]}).ok,false);
assert.equal(projectEvents({...batch,events:[event(11,'incident.remediation_attempted')]}).ok,false);
assert.equal(projectEvents({...batch,events:[{...event(11,'incident.remediation_attempted'),
 attempt_ref:'attempt-1',evidence_ref:'trace-1'}]}).ok,true);
// HTTP surface: isolated Forge process, no external MAS plugins, no agent or graph.
const free=()=>new Promise(resolvePort=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>resolvePort(port));});});
const port=await free(),secret='forge-r03-strong-internal-test-secret';
const child=spawn(process.execPath,[resolve(root,'apps/forge/service.mjs')],{env:{...process.env,
 ADA_INTERNAL_KEY:secret,ADA_CAPS:'forge.read,forge.validate',APP_PORT:String(port)},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const query=(route,body,auth=true)=>fetch(base+route,{method:body?'POST':'GET',
 headers:{...(auth?{'x-internal-key':secret}:{}),'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2000)});
try{
 let active=false;
 for(let i=0;i<40;i++){
  try{if((await query('/health')).ok){active=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,50));
 }
 assert(active,'isolated core+Forge service must launch');
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(n=>n.id==='forge.providers.negotiate'));
 assert(graph.nodes.some(n=>n.id==='forge.events.project'));
 const p=await (await query('/invoke',{action:'forge.providers.negotiate',params:flow})).json();
 assert.equal(p.result.complete,false);
 const e=await (await query('/invoke',{action:'forge.events.project',params:batch})).json();
 assert.equal(e.result.actions.length,3);
 assert.equal((await query('/invoke',{action:'forge.events.project',params:batch},false)).status,401);
 const desc=await (await query('/invoke',{action:'forge.describe'})).json();
 assert.equal(desc.result.schema,'mechanicus.forge.adapter.v3');
 assert.equal(desc.result.external_effects,false);assert.equal(desc.result.stores_state,false);
 console.log('FORGE_R03_TEST_OK: fail-closed negotiation, no silent write failover, strict event projection, standalone HTTP');
}finally{child.kill();}

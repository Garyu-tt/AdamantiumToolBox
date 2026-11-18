import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {composeFunction,planPublication,prepareReconciliation,validateIncident} from '../apps/forge/pipeline.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fixture=JSON.parse(await readFile(resolve(root,'apps/forge/example.function.json'),'utf8'));
const params={function:fixture,request_id:'request-r02-0001',expected_revision:'rev-42'};
const intent=composeFunction(params);
assert.equal(intent.ok,true);
assert.equal(intent.persisted,false);
assert.equal(intent.ui_draft.availability,'unverified');
assert(intent.graph_intent.nodes.some(x=>x.id===fixture.id));
assert(intent.graph_intent.edges.some(x=>x.kind==='depends_on'));
const implicit=composeFunction({...params,function:{...fixture,ui:undefined}});
assert.equal(implicit.ui_draft.expose,true);
assert.equal(implicit.ui_draft.renderer,'raw');
assert.equal(composeFunction({...params,request_id:'x'}).ok,false);
const publication=planPublication(params);
assert.equal(publication.ok,true);
assert.equal(publication.published,false);
assert.equal(publication.ui_visible,false);
assert.equal(publication.executed,false);
assert(publication.steps.some(x=>x.id==='verify'));
assert(publication.steps.some(x=>x.id==='stage_ui'));
assert(publication.steps.some(x=>x.id==='commit'));
assert.equal(publication.execution_policy.abort_on_missing_port,true);
const hidden=planPublication({...params,function:{...fixture,ui:{expose:false}}});
assert.equal(hidden.ui_draft.expose,false);
assert(!hidden.steps.some(x=>x.id==='stage_ui'));
const reconcile=prepareReconciliation({function_ref:fixture.id,trigger:'dependency.changed',observed_revision:'rev-43'});
assert.equal(reconcile.ok,true);
assert.equal(reconcile.invalidated,false);
assert(reconcile.steps.some(x=>x.port==='graph.reverse_dependencies.read'));
assert(reconcile.steps.some(x=>x.port==='ui.contribution.revoke'));
assert.equal(prepareReconciliation({function_ref:fixture.id,trigger:'unknown',observed_revision:'r'}).ok,false);
const incident={incident_id:'incident-1',node_ref:fixture.id,cause:{code:'NO_PROVIDER',explanation:'No compatible provider'},
 evidence:[{ref:'trace:123'}],impact:{direct:[fixture.id]},remedies:[{action:'refresh discovery',risk:'safe'}]};
assert.equal(validateIncident(incident).ok,true);
assert.equal(validateIncident({...incident,cause:{code:'NO_PROVIDER'}}).ok,false);
assert.equal(validateIncident({...incident,remedies:[]}).ok,false);
const free=()=>new Promise(resolvePort=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{
 const port=s.address().port;s.close(()=>resolvePort(port));});});
const port=await free();
const child=spawn(process.execPath,[resolve(root,'apps/forge/service.mjs')],{env:{...process.env,
 ADA_INTERNAL_KEY:'forge-r02-strong-internal-test-secret',ADA_CAPS:'forge.read,forge.validate',APP_PORT:String(port)},stdio:'ignore'});
const base='http://127.0.0.1:'+port;
const query=(route,body,auth=true)=>fetch(base+route,{method:body?'POST':'GET',
 headers:{...(auth?{'x-internal-key':'forge-r02-strong-internal-test-secret'}:{}),'Content-Type':'application/json'},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2000)});
try{
 let ready=false;
 for(let i=0;i<40;i++){
  try{if((await query('/health')).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,50));
 }
 assert(ready);
 const graph=await (await query('/graph')).json();
 assert(graph.nodes.some(n=>n.id==='forge.publication.plan'));
 assert.equal((await query('/invoke',{action:'forge.compose',params},false)).status,401);
 const b=await (await query('/invoke',{action:'forge.publication.plan',params})).json();
 assert.equal(b.result.schema,'forge.publication.plan.v1');
 assert.equal(b.result.ui_visible,false);
 const e=await (await query('/invoke',{action:'forge.incident.validate',params:incident})).json();
 assert.equal(e.result.ok,true);
 const r=await (await query('/invoke',{action:'forge.reconcile.prepare',params:{
  function_ref:fixture.id,trigger:'provider.revoked',observed_revision:'rev-44'}})).json();
 assert.equal(r.result.ui_revoked,false);
 console.log('FORGE_R02_TEST_OK: graph/UI intents, transaction plan, invalidation, explained incidents, MAS HTTP auth');
}finally{child.kill();}

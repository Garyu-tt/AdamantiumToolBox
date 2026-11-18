import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync,sign} from 'node:crypto';
import {bundleHash,hash} from '../apps/gauntlet/shared.mjs';
import {submit,accept} from '../apps/gauntlet/pipeline.mjs';
import {load} from '../apps/gauntlet/state.mjs';
import {preflight} from '../apps/gauntlet/delivery.mjs';
import {identity,seal,trustEnvelope} from '../standards/mesh/identity.mjs';
import {receive} from '../standards/mesh/store.mjs';
import {planActivation} from '../standards/lifecycle/plan.mjs';
import {activate} from '../standards/lifecycle/apply.mjs';
import {current} from '../standards/lifecycle/registry.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'gauntlet-signed-handoff-'));
const root=join(home,'gauntlet'),runtime=join(home,'runtime');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const manifest={mas:'1.0',id:'specimen',name:'Specimen',version:'0.1.0',
 icon:'graph',lifecycle:'independent',service:{protocol:'mas-http-1',port:8997},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
 auth:{mode:'host-delegated'},permissions:['specimen.read'],
 events:{schema:'mas-event-1'},data:{refs:'mas-ref-1'},
 updates:{strategy:'semver',migrations:[]}};
const files={'manifest.json':JSON.stringify(manifest),
 'service.mjs':'export const ok=true;\n','view.js':'export const view=true;\n'};
const input={task_id:'signed-handoff-test',plugin_id:'specimen',author_id:'claude',
 files,sha256:bundleHash(files)};
const checks=['syntax','build','dependencies','isolation','unit','integration',
 'contract','security','regression','no_hardcode','conflicts'];
const report={schema:'gauntlet-test-report-1',task_id:input.task_id,sha256:input.sha256,
 run_id:'qa-test-run-1',runner_id:'independent-qa-fixture',
 cost_usd:0,dynamic_ui_supported:false,dynamic_skip_reason:'fixture scope',
 tests:checks.map(name=>({name,status:'PASS',log:name,log_sha256:hash(name),
  command:'fixture '+name,exit_code:0,signal:null,duration_ms:10}))};
const signature=sign(null,Buffer.from(JSON.stringify(report)),privateKey).toString('base64');
try{
 await submit(root,input);
 const c=await accept(root,{task_id:input.task_id,report,signature},publicKey);
 assert.equal(c.status,'RELEASE_READY');
 const ready=await preflight(root,{task_id:input.task_id,sha256:input.sha256},publicKey);
 const stored=await load(root,input.task_id);
 const payload=JSON.parse(await readFile(join(root,'release-payloads',stored.release_payload),'utf8'));
 const owner=await identity(join(runtime,'mesh'));
 const envelope=seal(payload,owner);
 assert.equal(envelope.hash,ready.mesh_payload_sha256);
 const trust={[owner.id]:{publicKey:owner.publicKey,receive:true,activate:true}};
 assert.equal(trustEnvelope(envelope,trust).manifest.id,'specimen');
 await assert.rejects(async()=>trustEnvelope({...envelope,hash:'0'.repeat(64)},trust),
  /tampered_package/);
 await assert.rejects(async()=>trustEnvelope({...envelope,signature:'AA=='},trust),
  /bad_signature/);
 const received=await receive(runtime,envelope,trust);
 assert.equal(received.hash,envelope.hash);
 await assert.rejects(planActivation(project,runtime,envelope.hash),/missing_owner_policy/);
 await writeFile(join(runtime,'policy.json'),
  JSON.stringify({schema:'mas-owner-policy-1',capabilities:['specimen.read']}));
 const plan=await planActivation(project,runtime,envelope.hash);
 assert.equal(plan.hash,envelope.hash);
 assert.equal(plan.version,'0.1.0');
 await assert.rejects(activate(project,runtime,plan,false),/explicit_approval_required/);
 assert.deepEqual((await current(runtime)).apps,[]);
 console.log('GAUNTLET_SIGNED_HANDOFF_OK isolated Ed25519 Mesh store and Lifecycle plan; no activation');
}finally{await rm(home,{recursive:true,force:true});}

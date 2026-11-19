import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {bundleHash,hash} from '../apps/gauntlet/shared.mjs';
import {validatePayload} from '../standards/mesh/bundle.mjs';
import {inspect} from '../apps/gauntlet/inspect.mjs';
import {submit,accept} from '../apps/gauntlet/pipeline.mjs';
import {list} from '../apps/gauntlet/state.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const root=await mkdtemp(join(tmpdir(),'gauntlet-'));
const manifest={mas:'1.0',id:'specimen',name:'Specimen',version:'0.1.0',icon:'graph',
 lifecycle:'independent',service:{protocol:'mas-http-1',port:8973},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},auth:{mode:'host-delegated'},
 permissions:['specimen.read'],events:{schema:'mas-event-1'},
 data:{refs:'mas-ref-1'},updates:{strategy:'semver',migrations:[]}};
const files={'manifest.json':JSON.stringify(manifest),
 'service.mjs':"export const ok=true;\n",'view.js':"export const view=true;\n"};
const input={task_id:'qa-sample-01',plugin_id:'specimen',author_id:'claude',
 files,sha256:bundleHash(files)};
function evidence(name,status='PASS'){
 const log=name+' test output: '+status;
 return {name,status,log,log_sha256:hash(log),command:'qa-fixture '+name,
  exit_code:status==='PASS'?0:1,signal:null,duration_ms:10};
}
const required=['syntax','build','dependencies','isolation','unit','integration',
 'contract','security','regression','no_hardcode','conflicts'];
const report={schema:'gauntlet-test-report-1',task_id:input.task_id,sha256:input.sha256,
 run_id:'ci-run-001',runner_id:'independent-qa',cost_usd:1,dynamic_ui_supported:false,
 dynamic_skip_reason:'static view fixture',tests:required.map(name=>evidence(name))};
const signed=r=>({task_id:input.task_id,report:r,
 signature:sign(null,Buffer.from(JSON.stringify(r)),privateKey).toString('base64')});
try{
 assert.deepEqual(inspect(input).issues,[]);
 let c=await submit(root,input);
 assert.equal(c.status,'BUILDING');
 c=await submit(root,input);assert.equal(c.attempts,1);
 report.challenge=c.challenge;
 await assert.rejects(accept(root,{task_id:input.task_id,report,signature:'invalid'},publicKey),/signature/);
 c=await accept(root,signed(report),publicKey);assert.equal(c.status,'RELEASE_READY');
 assert(c.history.some(x=>x.status==='VERIFIED'));
 assert.equal((await readdir(join(root,'delivery-outbox'))).length,1);
 const bad={...input,task_id:'qa-bad-01',sha256:'0'.repeat(64)};
 c=await submit(root,bad);assert.equal(c.status,'BLOCKED');
 assert(c.issues.includes('checksum_mismatch'));
 assert.equal((await list(root)).length,2);
 assert((await readdir(join(root,'fixiki-outbox'))).length>0);
 const candidate=(await readdir(join(root,'candidates')))[0];
 const rc=JSON.parse(await readFile(join(root,'candidates',candidate),'utf8'));
 assert.equal(rc.sha256,input.sha256);
 const delivery=(await readdir(join(root,'delivery-outbox')))[0];
 const deliveryDoc=JSON.parse(await readFile(join(root,'delivery-outbox',delivery),'utf8'));
 assert.equal(deliveryDoc.approval,'REQUIRED');
 assert.equal(deliveryDoc.status,'PENDING_DELIVERY');
 const payload=JSON.parse(await readFile(join(root,'release-payloads',
  deliveryDoc.release_payload),'utf8'));
 assert.equal(validatePayload(payload).manifest.id,'specimen');
 assert.equal(hash(JSON.stringify(payload)),deliveryDoc.mesh_payload_sha256);
 console.log('GAUNTLET_R01_OK sha256 evidence signature diagnostic Fixiki delivery');
}finally{await rm(root,{recursive:true,force:true});}

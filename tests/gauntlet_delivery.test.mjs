import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {generateKeyPairSync,sign} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {bundleHash,hash} from '../apps/gauntlet/shared.mjs';
import {load} from '../apps/gauntlet/state.mjs';
import {submit,accept} from '../apps/gauntlet/pipeline.mjs';
import {preflight} from '../apps/gauntlet/delivery.mjs';
const root=await mkdtemp(join(tmpdir(),'gauntlet-delivery-'));
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const manifest={mas:'1.0',id:'specimen',name:'Specimen',version:'0.1.0',
 icon:'graph',lifecycle:'independent',service:{protocol:'mas-http-1',port:8997},
 ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
 auth:{mode:'host-delegated'},permissions:['specimen.read'],
 events:{schema:'mas-event-1'},data:{refs:'mas-ref-1'},
 updates:{strategy:'semver',migrations:[]}};
const files={'manifest.json':JSON.stringify(manifest),
 'service.mjs':'export const ok=true;\n','view.js':'export const view=true;\n'};
const tests=['syntax','build','dependencies','isolation','unit','integration',
 'contract','security','regression','no_hardcode','conflicts'];
const input={task_id:'delivery-qa-01',plugin_id:'specimen',author_id:'claude',
 files,sha256:bundleHash(files)};
const report={schema:'gauntlet-test-report-1',task_id:input.task_id,
 sha256:input.sha256,run_id:'fixture-001',runner_id:'independent-verifier',
 cost_usd:0,dynamic_ui_supported:false,dynamic_skip_reason:'isolated fixture',
 tests:tests.map(name=>({name,status:'PASS',log:name,log_sha256:hash(name),
  command:'fixture '+name,exit_code:0,signal:null,duration_ms:10}))};
let signature;
try{
 const first=await submit(root,input);report.challenge=first.challenge;
 signature=sign(null,Buffer.from(JSON.stringify(report)),privateKey).toString('base64');
 let c=await accept(root,{task_id:input.task_id,report,signature},publicKey);
 assert.equal(c.status,'RELEASE_READY');
 const current=await load(root,input.task_id);
 const request={task_id:input.task_id,sha256:input.sha256};
 const ok=await preflight(root,request,publicKey);
 assert.equal(ok.status,'READY_FOR_AUTHORIZED_SIGNER');
 assert.equal(ok.approval,'REQUIRED');
 assert.equal(ok.mesh_payload_sha256.length,64);
 await assert.rejects(preflight(root,{...request,queue_sha256:'0'.repeat(64)},publicKey),
  /stale_queue_reference/);
 const tampered=JSON.parse(await readFile(join(root,'release-payloads',
  current.release_payload),'utf8'));
 tampered.files['view.js']='Zm9yZ2Vk';
 await writeFile(join(root,'release-payloads',current.release_payload),
  JSON.stringify(tampered));
 await assert.rejects(preflight(root,request,publicKey),/artifact_integrity_failure/);
 const next={...files,'view.js':'export const other=true;\n'};
 await submit(root,{...input,files:next,sha256:bundleHash(next)});
 await assert.rejects(preflight(root,request,publicKey),/stale_or_unverified_candidate/);
 const replay=await submit(root,input);
 assert.notEqual(replay.challenge,first.challenge);
 await assert.rejects(accept(root,{task_id:input.task_id,report,signature},publicKey),
  /attestation_mismatch/);
 console.log('GAUNTLET_DELIVERY_PREFLIGHT_OK source lineage, QA signature, stale and tampering');
}finally{await rm(root,{recursive:true,force:true});}

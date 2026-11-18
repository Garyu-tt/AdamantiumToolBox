import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {stagePackage} from './package.mjs';
import {attest} from './attestation.mjs';
import {load} from './state.mjs';
import {hash,bundleHash,validHash,validTask} from './shared.mjs';
const safe=name=>typeof name==='string'&&/^[a-f0-9]{64}\.json$/.test(name);
async function content(root,kind,name){
 if(!['candidates','release-payloads','delivery-outbox','qa-evidence']
  .includes(kind)||!safe(name))throw Error('invalid_artifact_reference');
 const value=JSON.parse(await readFile(join(root,kind,name),'utf8'));
 if(hash(JSON.stringify(value))+'.json'!==name)throw Error('artifact_integrity_failure');
 return value;
}
export async function preflight(root,request,publicKey){
 if(!validTask(request?.task_id)||!validHash(request?.sha256))throw Error('invalid_request');
 const c=await load(root,request.task_id);
 if(!c||c.status!=='RELEASE_READY'||c.sha256!==request.sha256||
  !safe(c.candidate)||!safe(c.delivery)||!safe(c.release_payload))
  throw Error('stale_or_unverified_candidate');
 if(request.queue_sha256&&request.queue_sha256!==c.delivery.slice(0,64))
  throw Error('stale_queue_reference');
 if(bundleHash(c.files)!==c.sha256)throw Error('case_source_modified');
 const queue=await content(root,'delivery-outbox',c.delivery);
 if(queue.task_id!==c.task_id||queue.sha256!==c.sha256||
  queue.status!=='PENDING_DELIVERY'||queue.approval!=='REQUIRED'||
  queue.artifact!==c.candidate||queue.release_payload!==c.release_payload)
  throw Error('delivery_queue_mismatch');
 const rc=await content(root,'candidates',c.candidate);
 const payload=await content(root,'release-payloads',c.release_payload);
 const staged=stagePackage(c);
 const manifest=JSON.parse(c.files['manifest.json']);
 const digest=hash(JSON.stringify(payload));
 if(JSON.stringify(payload)!==JSON.stringify(staged.payload)||
  digest!==staged.mesh_payload_sha256)throw Error('payload_mismatch');
 if(manifest.id!==c.plugin_id||bundleHash(rc.files)!==c.sha256||
  rc.task_id!==c.task_id||rc.sha256!==c.sha256||
  rc.release_payload!==c.release_payload||
  rc.mesh_payload_sha256!==digest||queue.mesh_payload_sha256!==digest)
  throw Error('release_lineage_mismatch');
 const files=Object.entries(rc.files);
 if(files.length!==Object.keys(payload.files).length||
  files.some(([name,source])=>payload.files[name]!==Buffer.from(source,'utf8').toString('base64')))
  throw Error('release_source_mismatch');
 const proof=await content(root,'qa-evidence',c.qa_evidence);
 if(JSON.stringify(proof)!==JSON.stringify({
  report:rc.attestation,signature:rc.signature
 }))throw Error('qa_evidence_mismatch');
 const checked=attest({report:proof.report,signature:proof.signature},c,publicKey);
 if(checked.issues.length)throw Error('qa_acceptance_revoked');
 return {schema:'gauntlet-signing-preflight-1',task_id:c.task_id,
  source_sha256:c.sha256,plugin_id:c.plugin_id,version:manifest.version,
  mesh_payload_sha256:digest,release_payload:c.release_payload,
  candidate_sha256:c.candidate.slice(0,64),queue_sha256:c.delivery.slice(0,64),
  approval:'REQUIRED',status:'READY_FOR_AUTHORIZED_SIGNER'};
}

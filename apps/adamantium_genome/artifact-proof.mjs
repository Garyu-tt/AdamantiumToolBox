// R02: independently signed, content-addressed artifact closure for inert expression.
// This module never downloads artifacts, loads providers or starts any process.
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {decodeGraphGenome,planGenomeExpression} from './genome.mjs';
import {plain,name,hash,check} from './validation.mjs';

export const ARTIFACT_CATALOG_SCHEMA='mechanicus.genome.artifacts/1';
const digestPattern=/^sha256:[0-9a-f]{64}$/;
const typePattern=/^[a-z][a-z0-9_.-]*@[1-9][0-9]*$/;
const formats=new Set(['application/wasm','application/vnd.mechanicus.native',
 'text/javascript','application/vnd.mechanicus.ir']);
const targets=new Set(['portable','linux-x64','windows-x64','linux-arm64','windows-arm64']);
const int=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const exactly=(o,fields)=>plain(o)&&Object.keys(o).length===fields.length&&
 fields.every(k=>Object.hasOwn(o,k));
const bytesHash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const body=catalog=>({
 schema:catalog.schema,genomeId:catalog.genomeId,
 genomeDigest:catalog.genomeDigest,graphRevision:catalog.graphRevision,
 signerKeyId:catalog.signerKeyId,artifacts:catalog.artifacts
});
export function artifactSignaturePayload(catalog){
 // Domain separation prevents reuse as a different manifest or command signature.
 return Buffer.from('mechanicus.genome.artifacts/1\n'+hash(body(catalog)),'utf8');
}
export function verifySignedArtifacts(genome,catalog,trustRoots,blobs,{target='portable'}={}){
 const graph=decodeGraphGenome(genome),requirements=planGenomeExpression(genome);
 check(exactly(catalog,['schema','genomeId','genomeDigest','graphRevision',
  'signerKeyId','artifacts','signature'])&&
  catalog.schema===ARTIFACT_CATALOG_SCHEMA&&catalog.genomeId===genome.id&&
  catalog.genomeDigest===genome.originDigest&&
  catalog.graphRevision===graph.revision&&
  typeof catalog.signerKeyId==='string'&&name.test(catalog.signerKeyId)&&
  Array.isArray(catalog.artifacts)&&catalog.artifacts.length<=1024&&
  typeof catalog.signature==='string'&&
  /^[A-Za-z0-9+/]{86}==$/.test(catalog.signature),
  'invalid_artifact_catalog');
 check(targets.has(target),'unsupported_target');
 check(plain(trustRoots)&&Object.hasOwn(trustRoots,catalog.signerKeyId),
  'unknown_signing_root');
 let publicKey;
 try{publicKey=createPublicKey(trustRoots[catalog.signerKeyId]);}
 catch{throw new RangeError('invalid_signing_root');}
 check(publicKey.asymmetricKeyType==='ed25519','non_ed25519_signing_root');
 const signature=Buffer.from(catalog.signature,'base64');
 check(signature.length===64&&verifySignature(null,artifactSignaturePayload(catalog),
  publicKey,signature),'artifact_signature_invalid');
 check(blobs instanceof Map,'untrusted_blob_store');
 check(requirements.typeReferences.every(x=>typePattern.test(x)),
  'composite_expression_requires_graph_catalog');
 const required=new Set(requirements.typeReferences),found=new Set();
 let totalBytes=0;const resolved=[];
 for(const a of catalog.artifacts){
  check(exactly(a,['typeRef','digest','bytes','format','target'])&&
   typeof a.typeRef==='string'&&typePattern.test(a.typeRef)&&required.has(a.typeRef)&&
   !found.has(a.typeRef)&&typeof a.digest==='string'&&digestPattern.test(a.digest)&&
   int(a.bytes,0,32*1024*1024)&&formats.has(a.format)&&targets.has(a.target),
   'invalid_artifact_record');
  found.add(a.typeRef);
  check(a.target==='portable'||a.target===target,'incompatible_artifact_target');
  check(blobs.has(a.digest),'missing_artifact_blob');
  const blob=blobs.get(a.digest);
  check(blob instanceof Uint8Array&&blob.byteLength===a.bytes,
   'artifact_size_mismatch');
  totalBytes+=a.bytes;
  check(totalBytes<=64*1024*1024,'artifact_total_budget');
  check(bytesHash(blob)===a.digest,'artifact_hash_mismatch');
  resolved.push({typeRef:a.typeRef,digest:a.digest,bytes:a.bytes,
   format:a.format,target:a.target});
 }
 check(found.size===required.size,'missing_required_artifact');
 return {schema:'mechanicus.genome.expression-receipt/1',
  genomeId:genome.id,genomeDigest:genome.originDigest,
  graphId:graph.id,graphRevision:graph.revision,
  signerKeyId:catalog.signerKeyId,manifestDigest:hash(body(catalog)),
  artifactCount:resolved.length,totalBytes,artifacts:resolved,
  verifiedSignature:true,verifiedBytes:true,verifiedNativeCompiler:false,
  verifiedPolicy:false,authorized:false,executable:false,
  requires:['native-g0-compiler','policy-and-owner-consent',
   'isolated-runtime-test','durable-rollback-point']};
}

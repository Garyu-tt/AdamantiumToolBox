import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {encodeGraphGenome,planGenomeExpression} from '../apps/adamantium_genome/genome.mjs';
import {artifactSignaturePayload,verifySignedArtifacts} from '../apps/adamantium_genome/artifact-proof.mjs';
import {proveStructuralSelfHosting} from '../apps/adamantium_genome/selfhost-proof.mjs';
import {selfHostGraph} from './adamantium_genome_fixtures.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const keys=generateKeyPairSync('ed25519');
const roots={'trusted-root':keys.publicKey.export({type:'spki',format:'pem'})};
function fixture(){
 const genome=encodeGraphGenome(selfHostGraph());
 const blobs=new Map();
 const artifacts=planGenomeExpression(genome).typeReferences.map(typeRef=>{
  const data=Buffer.from('reproducible-fixture-artifact:'+typeRef);
  const digest='sha256:'+createHash('sha256').update(data).digest('hex');
  blobs.set(digest,data);
  return {typeRef,digest,bytes:data.length,format:'application/vnd.mechanicus.ir',target:'portable'};
 });
 const catalog={schema:'mechanicus.genome.artifacts/1',genomeId:genome.id,
  genomeDigest:genome.originDigest,graphRevision:4,signerKeyId:'trusted-root',
  artifacts,signature:''};
 resign(catalog);
 return {genome,blobs,catalog};
}
const resign=catalog=>{catalog.signature=sign(null,artifactSignaturePayload(catalog),
 keys.privateKey).toString('base64');return catalog};
test('signed digest closure verifies complete self-host GENESIS graph',()=>{
 const {genome,catalog,blobs}=fixture();
 const receipt=verifySignedArtifacts(genome,catalog,roots,blobs);
 assert.equal(receipt.verifiedSignature,true);
 assert.equal(receipt.verifiedBytes,true);
 assert.equal(receipt.verifiedNativeCompiler,false);
 assert.equal(receipt.authorized,false);
 assert.equal(receipt.artifactCount,4);
 const proof=proveStructuralSelfHosting(genome,catalog,roots,blobs);
 assert.equal(proof.structuralFixedPoint,true);
 assert.equal(proof.generation1Digest,proof.generation2Digest);
 assert.equal(proof.originalDigest,proof.generation1Digest);
 assert.equal(proof.compiledNativeExecutable,false);
 assert.equal(proof.runtimeReplaced,false);
});
test('tampered bytes fail even with a valid signed catalog',()=>{
 const {genome,catalog,blobs}=fixture();
 const first=catalog.artifacts[0];
 blobs.set(first.digest,Buffer.alloc(first.bytes,0));
 assert.throws(()=>verifySignedArtifacts(genome,catalog,roots,blobs),/artifact_hash_mismatch/);
});
test('tampering the signed manifest or trust root fails closed',()=>{
 const {genome,catalog,blobs}=fixture();
 const forged=clone(catalog);forged.graphRevision++;
 assert.throws(()=>verifySignedArtifacts(genome,forged,roots,blobs),/invalid_artifact_catalog/);
 const forged2=clone(catalog);forged2.artifacts[0].format='text/javascript';
 assert.throws(()=>verifySignedArtifacts(genome,forged2,roots,blobs),/artifact_signature_invalid/);
 assert.throws(()=>verifySignedArtifacts(genome,catalog,{},blobs),/unknown_signing_root/);
 const key2=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
 assert.throws(()=>verifySignedArtifacts(genome,catalog,{'trusted-root':key2},blobs),
  /artifact_signature_invalid/);
});
test('missing, duplicate and unapproved artifact types fail with fresh signatures',()=>{
 const {genome,catalog,blobs}=fixture();
 const missing=clone(catalog);missing.artifacts.pop();resign(missing);
 assert.throws(()=>verifySignedArtifacts(genome,missing,roots,blobs),/missing_required_artifact/);
 const duplicate=clone(catalog);duplicate.artifacts.push(clone(duplicate.artifacts[0]));resign(duplicate);
 assert.throws(()=>verifySignedArtifacts(genome,duplicate,roots,blobs),/invalid_artifact_record/);
 const extra=clone(catalog);extra.artifacts[0].typeRef='mechanicus.unknown@1';resign(extra);
 assert.throws(()=>verifySignedArtifacts(genome,extra,roots,blobs),/invalid_artifact_record/);
});
test('platform checks never accept a mismatched native artifact',()=>{
 const {genome,catalog,blobs}=fixture();
 catalog.artifacts[0].target='windows-x64';resign(catalog);
 assert.throws(()=>verifySignedArtifacts(genome,catalog,roots,blobs),/incompatible_artifact_target/);
 assert.equal(verifySignedArtifacts(genome,catalog,roots,blobs,{target:'windows-x64'}).authorized,false);
});
test('unknown compiler or absence of verified artifact prohibits fixed-point claim',()=>{
 const {genome,catalog,blobs}=fixture();
 assert.throws(()=>proveStructuralSelfHosting(genome,catalog,roots,blobs,
  {compilerTypeRef:'adamantium.unknown@1'}),/genome_has_no_compiler_gene/);
 const cut=clone(catalog);cut.artifacts=cut.artifacts.filter(a=>a.typeRef!=='adamantium.genome.compiler@1');
 resign(cut);
 assert.throws(()=>proveStructuralSelfHosting(genome,cut,roots,blobs),/missing_required_artifact/);
});

// R02 self-host proof: two *structural* generations under an independent verifier.
// This is NOT proof of native executable recompilation or live GENESIS replacement.
import {encodeGraphGenome,decodeGraphGenome} from './genome.mjs';
import {verifySignedArtifacts} from './artifact-proof.mjs';
import {check,hash} from './validation.mjs';

export function proveStructuralSelfHosting(genome,catalog,trustRoots,blobs,{
 target='portable',compilerTypeRef='adamantium.genome.compiler@1'}={}){
 // Verify the actual signed manifest and all artifact bytes, not an assertion
 // copied from an earlier receipt or controlled by the candidate runtime.
 const receipt=verifySignedArtifacts(genome,catalog,trustRoots,blobs,{target});
 const graph0=decodeGraphGenome(genome);
 check(graph0.nodes.some(n=>n.typeRef===compilerTypeRef),
  'genome_has_no_compiler_gene');
 check(receipt.artifacts.some(a=>a.typeRef===compilerTypeRef),
  'compiler_artifact_not_verified');
 const next1=encodeGraphGenome(graph0,{genomeId:genome.id});
 const graph1=decodeGraphGenome(next1);
 const next2=encodeGraphGenome(graph1,{genomeId:genome.id});
 const graph2=decodeGraphGenome(next2);
 const h0=hash(graph0),h1=hash(graph1),h2=hash(graph2);
 check(h0===h1&&h1===h2&&next1.originDigest===next2.originDigest,
  'genome_structural_fixed_point_failed');
 return {schema:'mechanicus.genome.structural-selfhost-proof/1',
  graphId:graph0.id,genomeId:genome.id,originalDigest:h0,
  generation1Digest:h1,generation2Digest:h2,
  manifestDigest:receipt.manifestDigest,signerKeyId:receipt.signerKeyId,
  verifiedArtifactCount:receipt.artifactCount,
  structuralFixedPoint:true,
  compiledNativeExecutable:false,runtimeReplaced:false,
  verifiedNativeCompiler:false,verifiedPolicy:false,
  authorized:false,executable:false,
  nextGate:'isolated signed compiler execution with byte-for-byte native reproducibility'};
}

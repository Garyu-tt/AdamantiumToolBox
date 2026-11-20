/** MLG3 exact codec, reverse graph execution and verified MLG2 migration. */
import {deflateSync,inflateSync} from 'node:zlib';
import {tryRootTransform} from './root_transform.mjs';
import {decodeRootReference,referenceDecodeGraph} from './reference_verify.mjs';
import {runMathByteOperation} from './operation_kernels.mjs';
import {GRAPH_PLAN_ABI,resolveOperation,validateOperationPlan,buildEncodeDecodeGraphs,LEGACY_R02_TRANSFORMS,LEGACY_R02_CODECS} from './operation_registry.mjs';
import {MATH_GRAPH_FRAME_ABI,MATH_GRAPH_FRAME_MAGIC,V2,MAX_INPUT,MAX_FRAME,MAX_STEPS,sha,err,readVarint,formatEnvelope,readFrame} from './operation_frame_wire.mjs';
export {MATH_GRAPH_FRAME_ABI,MATH_GRAPH_FRAME_MAGIC} from './operation_frame_wire.mjs';
function decodeValidated(f){
 let value;
 try{
  if(f.plan.codecId===0x0201)
   value=inflateSync(f.payload,{maxOutputLength:Math.max(1,f.length)});
  else if(f.plan.codecId===0x0202)
   value=decodeRootReference(f.payload,Math.max(1,f.length));
  else err('unsupported codec');
 }catch(e){err('failed leaf decode: '+String(e.message).slice(0,120));}
 if(value.length!==f.length)err('decoded length mismatch');
 for(let i=f.plan.operationIds.length-1;i>=0;i--){
  const inverseId=resolveOperation(f.plan.operationIds[i]).inverseId;
  value=runMathByteOperation(value,inverseId);
 }
 if(!sha(value).subarray(0,16).equals(f.checksum)){
  err('source checksum mismatch');
 }
 return value;
}
export function decodeOperationGraphFrame(frame,options={}){
 const read=readFrame(frame,options),original=decodeValidated(read);
 return Object.freeze({
  data:original,plan:read.plan,
  graphs:buildEncodeDecodeGraphs({schema:read.plan.schema,operationIds:read.plan.operationIds,codecId:read.plan.codecId}),
  sourceSha256:sha(original).toString('hex'),
  encodedSha256:sha(frame).toString('hex'),
  checksumVerified:true,
  authenticated:false,executionAuthorized:false
 });
}
export function encodeOperationGraphFrame(original,plan,{rootDegrees,maxRootEvaluations=32}={}){
 if(!Buffer.isBuffer(original)||original.length>MAX_INPUT)err('invalid bounded input');
 const validated=validateOperationPlan(plan);
 let transformed=Buffer.from(original);
 for(const op of validated.operationIds)
  transformed=runMathByteOperation(transformed,op);
 let leaf;
 if(validated.codecId===0x0201)
  leaf=deflateSync(transformed,{level:9});
 else if(validated.codecId===0x0202){
  const root=tryRootTransform(transformed,{
   degrees:rootDegrees,maxDepth:2,maxEvaluations:maxRootEvaluations
  });
  if(!root.compressed)err('RootTransform has no smaller standalone stream');
  leaf=root.compressed;
 }else err('unsupported encoder codec');
 const frame=formatEnvelope(original,validated,leaf);
 return Object.freeze({
  frame,bytes:frame.length,plan:validated,
  graphs:buildEncodeDecodeGraphs({schema:validated.schema,operationIds:validated.operationIds,codecId:validated.codecId}),
  sha256:sha(frame).toString('hex'),
  executionAuthorized:false,independentQACompleted:false
 });
}
/**
 * MLG2 migration adapter: exact legacy decoding first, then reframe the exact
 * same leaf and operations using stable R03 IDs and a checksum. No silent
 * reinterpretation of the old numeric opcodes.
 */
export function migrateLegacyMLG2(legacy,{maxOutputBytes=MAX_INPUT}={}){
 if(!Buffer.isBuffer(legacy)||legacy.length<9||legacy.length>MAX_FRAME||
  !legacy.subarray(0,4).equals(V2))err('not a legacy R02 graph');
 const original=referenceDecodeGraph(legacy,{maxOutputBytes});
 const pos={at:4},length=readVarint(legacy,pos,MAX_INPUT);
 if(length!==original.length)err('legacy length mismatch');
 if(pos.at>=legacy.length)err('legacy missing depth');
 const count=legacy[pos.at++];
 if(count<1||count>MAX_STEPS)err('legacy unsupported depth');
 if(pos.at+count>=legacy.length)err('legacy truncated operations');
 const operations=[];
 for(let i=0;i<count;i++){
  const legacyId=legacy[pos.at++];
  if(!Object.hasOwn(LEGACY_R02_TRANSFORMS,legacyId))err('unknown legacy transform ID');
  operations.push(LEGACY_R02_TRANSFORMS[legacyId]);
 }
 const legacyCodec=legacy[pos.at++];
 if(!Object.hasOwn(LEGACY_R02_CODECS,legacyCodec))err('unknown legacy codec ID');
 const plan=validateOperationPlan({
  schema:GRAPH_PLAN_ABI,
  operationIds:operations,codecId:LEGACY_R02_CODECS[legacyCodec]
 });
 const frame=formatEnvelope(original,plan,legacy.subarray(pos.at));
 const reread=decodeOperationGraphFrame(frame,{maxOutputBytes});
 if(!reread.data.equals(original))err('legacy migration altered original bytes');
 return Object.freeze({
  frame,plan,originalSha256:sha(original).toString('hex'),
  legacySha256:sha(legacy).toString('hex'),
  migratedSha256:sha(frame).toString('hex'),
  preservedExactly:true,executionAuthorized:false
 });
}

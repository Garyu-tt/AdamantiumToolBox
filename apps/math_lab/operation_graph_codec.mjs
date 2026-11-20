/**
 * Mechanicus Math Lab R03 — versioned, self-describing, reversible MLG3 frame.
 * A stable numeric operation ID is meaningful only with the pinned registry
 * ABI and digest. SHA256-128 detects corruption; it is NOT authentication.
 */
import {createHash} from 'node:crypto';
import {deflateSync,inflateSync} from 'node:zlib';
import {tryRootTransform} from './root_transform.mjs';
import {decodeRootReference,referenceDecodeGraph} from './reference_verify.mjs';
import {runMathByteOperation} from './operation_kernels.mjs';
import {
 GRAPH_PLAN_ABI,REGISTRY_MAJOR,REGISTRY_FINGERPRINT,REGISTRY_SHA256,
 resolveOperation,validateOperationPlan,buildEncodeDecodeGraphs,
 LEGACY_R02_TRANSFORMS,LEGACY_R02_CODECS
} from './operation_registry.mjs';

export const MATH_GRAPH_FRAME_ABI='mechanicus.math-graph-frame/3';
export const MATH_GRAPH_FRAME_MAGIC='MLG3';
const MAGIC=Buffer.from(MATH_GRAPH_FRAME_MAGIC,'ascii');
const V2=Buffer.from('MLG2','ascii');
const MAX_INPUT=8192,MAX_FRAME=8448,MAX_STEPS=3;
const sha=b=>createHash('sha256').update(b).digest();
function err(text){throw new TypeError('Math graph frame rejected: '+text);}
function varint(value){
 if(!Number.isSafeInteger(value)||value<0||value>MAX_FRAME)err('invalid integer header');
 const out=[];
 do{const rem=value%128;value=Math.floor(value/128);out.push(rem+(value?128:0));}while(value);
 return Buffer.from(out);
}
function readVarint(buf,pos,maximum){
 const start=pos.at;let value=0,multiplier=1;
 for(let i=0;i<4;i++){
  if(pos.at>=buf.length)err('truncated integer header');
  const b=buf[pos.at++];
  value+=(b&127)*multiplier;
  if(!Number.isSafeInteger(value)||value>maximum)err('integer header exceeds budget');
  if(!(b&128)){
   if(pos.at-start!==varint(value).length)err('noncanonical integer header');
   return value;
  }
  multiplier*=128;
 }
 err('oversized integer header');
}
function uint16(value){
 const b=Buffer.alloc(2);b.writeUInt16BE(value);return b;
}
function readUint16(buf,pos){
 if(pos.at+2>buf.length)err('truncated operation id');
 const v=buf.readUInt16BE(pos.at);pos.at+=2;return v;
}
function formatEnvelope(original,plan,leaf){
 if(!Buffer.isBuffer(original)||original.length>MAX_INPUT)err('input budget');
 if(!Buffer.isBuffer(leaf)||leaf.length>MAX_FRAME)err('payload budget');
 const ops=plan.operationIds;
 const full=Buffer.concat([
  MAGIC,Buffer.from([REGISTRY_MAJOR]),REGISTRY_FINGERPRINT,
  varint(original.length),Buffer.from([ops.length]),
  ...ops.map(uint16),uint16(plan.codecId),
  varint(leaf.length),sha(original).subarray(0,16),leaf
 ]);
 if(full.length>MAX_FRAME)err('frame exceeds budget');
 return full;
}
function readFrame(bytes,{maxOutputBytes=MAX_INPUT}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<34||bytes.length>MAX_FRAME||
   !bytes.subarray(0,4).equals(MAGIC))err('not an MLG3 frame');
 if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>MAX_INPUT){
  err('invalid output limit');
 }
 const pos={at:4},major=bytes[pos.at++];
 if(major!==REGISTRY_MAJOR)err('unsupported operation registry major');
 const fingerprint=bytes.subarray(pos.at,pos.at+8);pos.at+=8;
 if(!fingerprint.equals(REGISTRY_FINGERPRINT))err('operation registry mismatch');
 const length=readVarint(bytes,pos,maxOutputBytes);
 if(pos.at>=bytes.length)err('truncated graph');
 const count=bytes[pos.at++];
 if(count>MAX_STEPS)err('graph depth limit');
 const ids=[];
 for(let i=0;i<count;i++)ids.push(readUint16(bytes,pos));
 const codecId=readUint16(bytes,pos);
 const plan=validateOperationPlan({
  schema:GRAPH_PLAN_ABI,operationIds:ids,codecId
 });
 const size=readVarint(bytes,pos,MAX_FRAME);
 if(pos.at+16+size!==bytes.length)err('payload length mismatch');
 const checksum=Buffer.from(bytes.subarray(pos.at,pos.at+16));
 pos.at+=16;
 const payload=Buffer.from(bytes.subarray(pos.at));
 return Object.freeze({plan,length,checksum,payload,registrySha256:REGISTRY_SHA256});
}
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
  graphs:buildEncodeDecodeGraphs(read.plan),
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
  graphs:buildEncodeDecodeGraphs(validated),
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

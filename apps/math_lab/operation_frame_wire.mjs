/** MLG3 fixed wire format and strict canonical binary header parser. */
import {createHash} from 'node:crypto';
import {GRAPH_PLAN_ABI,REGISTRY_MAJOR,REGISTRY_FINGERPRINT_HEX,REGISTRY_SHA256,validateOperationPlan} from './operation_registry.mjs';
export const MATH_GRAPH_FRAME_ABI='mechanicus.math-graph-frame/3';
export const MATH_GRAPH_FRAME_MAGIC='MLG3';
const MAGIC=Buffer.from(MATH_GRAPH_FRAME_MAGIC,'ascii');
export const V2=Buffer.from('MLG2','ascii');
export const MAX_INPUT=8192,MAX_FRAME=8448,MAX_STEPS=3;
export const sha=b=>createHash('sha256').update(b).digest();
export function err(text){throw new TypeError('Math graph frame rejected: '+text);}
function varint(value){
 if(!Number.isSafeInteger(value)||value<0||value>MAX_FRAME)err('invalid integer header');
 const out=[];
 do{const rem=value%128;value=Math.floor(value/128);out.push(rem+(value?128:0));}while(value);
 return Buffer.from(out);
}
export function readVarint(buf,pos,maximum){
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
export function formatEnvelope(original,plan,leaf){
 if(!Buffer.isBuffer(original)||original.length>MAX_INPUT)err('input budget');
 if(!Buffer.isBuffer(leaf)||leaf.length>MAX_FRAME)err('payload budget');
 const ops=plan.operationIds;
 const full=Buffer.concat([
  MAGIC,Buffer.from([REGISTRY_MAJOR]),Buffer.from(REGISTRY_FINGERPRINT_HEX,'hex'),
  varint(original.length),Buffer.from([ops.length]),
  ...ops.map(uint16),uint16(plan.codecId),
  varint(leaf.length),sha(original).subarray(0,16),leaf
 ]);
 if(full.length>MAX_FRAME)err('frame exceeds budget');
 return full;
}
export function readFrame(bytes,{maxOutputBytes=MAX_INPUT}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<34||bytes.length>MAX_FRAME||
   !bytes.subarray(0,4).equals(MAGIC))err('not an MLG3 frame');
 if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>MAX_INPUT){
  err('invalid output limit');
 }
 const pos={at:4},major=bytes[pos.at++];
 if(major!==REGISTRY_MAJOR)err('unsupported operation registry major');
 const fingerprint=bytes.subarray(pos.at,pos.at+8);pos.at+=8;
 if(fingerprint.toString('hex')!==REGISTRY_FINGERPRINT_HEX)err('operation registry mismatch');
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

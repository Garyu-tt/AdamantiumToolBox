import {optionsOf} from './root_options.mjs';
/**
 * Mechanicus Math Lab R01 — RootTransform, experimental integer-only codec.
 * This is a bounded, exact source transform, NOT a general-purpose compressor.
 * SPDX-License-Identifier: Apache-2.0
 */
const MAGIC=Buffer.from('MLR1');
const RAW=0,ROOT=1;
const MAX_INPUT_BYTES=8192;

function varint(value){
 if(!Number.isSafeInteger(value)||value<0)throw new TypeError('nonnegative varint required');
 const bytes=[];
 do{const digit=value%128;value=Math.floor(value/128);bytes.push(digit+(value>0?128:0));}while(value>0);
 return Buffer.from(bytes);
}
export function readVarint(buf,cursor,maximum){
 const first=cursor.pos;
 let n=0,pow=1;
 for(let i=0;i<8;i++){
  if(cursor.pos>=buf.length)throw new TypeError('truncated varint');
  const b=buf[cursor.pos++];
  n+=(b&127)*pow;
  if(!Number.isSafeInteger(n)||n>maximum)throw new TypeError('varint exceeds bound');
  if((b&128)===0){
   if(cursor.pos-first!==varint(n).length)throw new TypeError('noncanonical varint');
   return n;
  }
  pow*=128;
 }
 throw new TypeError('overlong varint');
}
export function bitLength(n){return n===0n?0:n.toString(2).length;}
export function integerBytes(n){
 if(n<0n)throw new TypeError('negative integer');
 if(n===0n)return Buffer.alloc(0);
 let hex=n.toString(16);
 if(hex.length%2)hex='0'+hex;
 return Buffer.from(hex,'hex');
}
export function naturalBytes(buf){
 if(buf.length>0&&buf[0]===0)throw new TypeError('nonminimal unsigned integer');
 return buf.length?BigInt('0x'+buf.toString('hex')):0n;
}
export function kthRootFloor(n,k){
 if(n<0n||!Number.isSafeInteger(k)||k<2)throw new TypeError('bad integer root');
 if(n<2n)return n;
 if(k>=bitLength(n))return 1n;
 const K=BigInt(k);
 let x=1n<<BigInt(Math.ceil(bitLength(n)/k));
 while(true){
  const y=((K-1n)*x+n/(x**(K-1n)))/K;
  if(y>=x)break;
  x=y;
 }
 while(x**K>n)x--;
 while((x+1n)**K<=n)x++;
 return x;
}

/**
 * @returns {{compressed: Buffer|null, evaluated: number, rawBytes: number,
 *            encodedBytes: number|null, mode: string}}
 * Returns null when no strictly smaller complete on-wire stream exists.
 * All codec/header/length/exponent/remainder bytes count against savings.
 */
export function tryRootTransform(data,opts={}){
 if(!Buffer.isBuffer(data))throw new TypeError('input must be Buffer');
 const {degrees,maxDepth,maxEvaluations,maxInputBytes}=optionsOf(opts);
 if(data.length>maxInputBytes)throw new RangeError('source input exceeds CPU budget');
 const originalLength=data.length;
 const n=data.length?BigInt('0x'+data.toString('hex')):0n;
 let evaluations=0;
 const cache=new Map();
 const encodeNode=(value,depth)=>{
  const bytes=integerBytes(value);
  let best=Buffer.concat([Buffer.from([RAW]),varint(bytes.length),bytes]);
  if(depth===0||value<2n)return best;
  const id=depth+':'+value.toString(16);
  if(cache.has(id))return cache.get(id);
  const bits=bitLength(value);
  for(const k of degrees){
   if(evaluations>=maxEvaluations)break;
   if(k>=bits)continue;
   evaluations++;
   const a=kthRootFloor(value,k),r=value-a**BigInt(k);
   const minPayload=1+varint(k).length+2+
    varint(integerBytes(a).length).length+integerBytes(a).length+
    varint(integerBytes(r).length).length+integerBytes(r).length;
   // Nested children may themselves compress: the raw-child estimate is
   // a valid pruning bound only at the final recursion level.
   if(depth===1&&minPayload>=best.length)continue;
   const candidate=Buffer.concat([
    Buffer.from([ROOT]),varint(k),encodeNode(a,depth-1),encodeNode(r,depth-1)
   ]);
   if(candidate.length<best.length)best=candidate;
  }
  cache.set(id,best);
  return best;
 };
 const node=encodeNode(n,maxDepth);
 const stream=Buffer.concat([MAGIC,varint(originalLength),node]);
 const compressed=stream.length<originalLength?stream:null;
 return Object.freeze({
  compressed,evaluated:evaluations,rawBytes:originalLength,
  encodedBytes:compressed?.length??null,
  mode:compressed?'root-transform':'raw-fallback'
 });
}
export {decodeRootTransform} from './root_decode.mjs';
export const ROOT_TRANSFORM_ABI='mechanicus.math-root-transform/1';
export const ROOT_TRANSFORM_LIMITS=Object.freeze({
 maxInputBytes:MAX_INPUT_BYTES,maxSearchDepth:3,maxEvaluations:300,
 maxOutputBytes:MAX_INPUT_BYTES,maxDegree:32768
});

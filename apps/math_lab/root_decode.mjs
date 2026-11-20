/** Bounded exact MLR1 integer decoder, independent file boundary. */
import {readVarint,bitLength,integerBytes,naturalBytes,kthRootFloor} from './root_transform.mjs';
const MAGIC=Buffer.from('MLR1');
const MAX_INPUT_BYTES=8192;
/**
 * Independent bounded decoder. Invalid/corrupt streams reject, never truncate.
 */
export function decodeRootTransform(packed,{maxOutputBytes=MAX_INPUT_BYTES,maxDepth=4,maxNodes=2048}={}){
 if(!Buffer.isBuffer(packed)||packed.length<5||!packed.subarray(0,4).equals(MAGIC)){
  throw new TypeError('not a RootTransform stream');
 }
 if(!Number.isInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>MAX_INPUT_BYTES||
    !Number.isInteger(maxDepth)||maxDepth<0||maxDepth>8||
    !Number.isInteger(maxNodes)||maxNodes<1||maxNodes>4096)throw new TypeError('decode budget');
 const cursor={pos:4},outputLength=readVarint(packed,cursor,maxOutputBytes);
 let nodes=0;
 const parse=(depth)=>{
  if(depth>maxDepth||++nodes>maxNodes)throw new RangeError('decode tree budget exceeded');
  if(cursor.pos>=packed.length)throw new TypeError('truncated node tag');
  const tag=packed[cursor.pos++];
  if(tag===RAW){
   const count=readVarint(packed,cursor,maxOutputBytes);
   if(cursor.pos+count>packed.length)throw new TypeError('truncated integer');
   const n=naturalBytes(packed.subarray(cursor.pos,cursor.pos+count));
   cursor.pos+=count;
   return n;
  }
  if(tag!==ROOT)throw new TypeError('unknown transform node');
  const k=readVarint(packed,cursor,32768);
  if(k<2)throw new TypeError('invalid degree');
  const a=parse(depth+1),r=parse(depth+1);
  if(a<1n)throw new TypeError('noncanonical base');
  const bits=bitLength(a)*k;
  if(bits>maxOutputBytes*8+k+8)throw new RangeError('root result exceeds budget');
  const n=a**BigInt(k)+r;
  if(bitLength(n)>maxOutputBytes*8)throw new RangeError('root result exceeds budget');
  if(kthRootFloor(n,k)!==a)throw new TypeError('noncanonical root remainder');
  return n;
 };
 const n=parse(0);
 if(cursor.pos!==packed.length)throw new TypeError('trailing transform bytes');
 if(bitLength(n)>outputLength*8)throw new RangeError('integer exceeds original block');
 const bytes=integerBytes(n);
 const restored=Buffer.alloc(outputLength);
 bytes.copy(restored,outputLength-bytes.length);
 return restored;
}

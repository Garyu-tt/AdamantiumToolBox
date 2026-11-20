/**
 * Mechanicus Math Lab R02: reference decoder for R01 RootTransform and R02
 * transform graph, intentionally NOT importing either production decoder
 * or graph-search transform implementation.
 *
 * Independent ALGORITHM/implementation, not an independent QA organization.
 */
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

export const REFERENCE_VERIFIER_ABI='mechanicus.math-reference-verifier/1';
const MAX_BYTES=8192,MAX_NODES=256;
const digest=data=>createHash('sha256').update(data).digest('hex');
function reject(message){throw new TypeError('Reference verifier rejected: '+message);}
function uint(buf,cursor,maximum){
 let value=0n,shift=0n;
 const start=cursor.at;
 for(let x=0;x<8;x++){
  if(cursor.at>=buf.length)reject('truncated integer header');
  const b=buf[cursor.at++];
  value+=BigInt(b&127)<<shift;
  if(value>BigInt(maximum))reject('integer header exceeds limit');
  if((b&128)===0){
   if(x>0 && b===0)reject('nonminimal integer header');
   if(start===cursor.at)reject('invalid header');
   return Number(value);
  }
  shift+=7n;
 }
 reject('oversized integer header');
}
function integerFromBytes(bytes){
 if(bytes.length>0&&bytes[0]===0)reject('nonminimal big integer');
 let n=0n;
 for(const b of bytes)n=(n<<8n)|BigInt(b);
 return n;
}
function integerToBytes(number,length){
 if(number<0n)reject('negative result');
 const output=Buffer.alloc(length);
 let n=number;
 for(let i=length-1;i>=0;i--){
  output[i]=Number(n&255n);
  n>>=8n;
 }
 if(n!==0n)reject('integer exceeds original block');
 return output;
}
function lengthBits(n){return n===0n?0:n.toString(2).length;}
function decodeRootReference(packed,maxOutputBytes=MAX_BYTES){
 if(packed.length<5||packed.subarray(0,4).toString('ascii')!=='MLR1')reject('invalid R01 root signature');
 const c={at:4},outputLength=uint(packed,c,maxOutputBytes);
 let nodes=0;
 function readNode(depth){
  if(depth>7||++nodes>MAX_NODES)reject('root recursion budget');
  if(c.at>=packed.length)reject('truncated root node');
  const tag=packed[c.at++];
  if(tag===0){
   const length=uint(packed,c,maxOutputBytes);
   if(c.at+length>packed.length)reject('truncated integer bytes');
   const n=integerFromBytes(packed.subarray(c.at,c.at+length));
   c.at+=length;
   return n;
  }
  if(tag!==1)reject('unknown root node');
  const k=uint(packed,c,32768);
  if(k<2)reject('degree below 2');
  const base=readNode(depth+1);
  const remainder=readNode(depth+1);
  if(base===0n)reject('noncanonical zero base');
  if(base>1n&&(lengthBits(base)-1)*k>maxOutputBytes*8)reject('power exceeds budget');
  const power=base**BigInt(k);
  if(lengthBits(power)>maxOutputBytes*8)reject('power overflow');
  const output=power+remainder;
  if(lengthBits(output)>maxOutputBytes*8)reject('decoded integer overflow');
  // Verify exact floor condition by upper bound; no Newton solver is reused.
  if(output>=(base+1n)**BigInt(k))reject('root remainder exceeds canonical range');
  return output;
 }
 const number=readNode(0);
 if(c.at!==packed.length)reject('trailing root bytes');
 return integerToBytes(number,outputLength);
}
function reverseStep(block,opcode){
 const out=Buffer.allocUnsafe(block.length),length=block.length;
 if(opcode===1){
  if(length)out[0]=block[0];
  for(let i=1;i<length;i++)out[i]=out[i-1]^block[i];
 }else if(opcode===2){
  if(length)out[0]=block[0];
  for(let i=1;i<length;i++)out[i]=(out[i-1]+block[i])&255;
 }else if(opcode===3){
  const even=Math.ceil(length/2);
  for(let i=0;i<even;i++)out[i*2]=block[i];
  for(let i=0;i<length-even;i++)out[i*2+1]=block[even+i];
 }else if(opcode===4){
  let pos=0;
  while(pos+8<=length){
   for(let row=0;row<8;row++){
    let b=0;
    for(let bit=0;bit<8;bit++)b|=((block[pos+bit]>>row)&1)<<bit;
    out[pos+row]=b;
   }
   pos+=8;
  }
  for(;pos<length;pos++)out[pos]=block[pos];
 }else if(opcode===5){
  for(let i=0;i<length;i++)out[i]=block[length-1-i];
 }else reject('unknown inverse opcode');
 return out;
}
/**
 * The ONLY accepted graph envelope is self-contained:
 * MLG2 | original-byte-count | step-count (1..3) | opcodes | codec | leaf.
 * It may use zlib (codec 1) or a nested standalone RootTransform (codec 2).
 */
export function referenceDecodeGraph(packed,{maxOutputBytes=MAX_BYTES}={}){
 if(!Buffer.isBuffer(packed)||packed.length<9||packed.length>MAX_BYTES||
   packed.subarray(0,4).toString('ascii')!=='MLG2')reject('invalid transform graph stream');
 if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>MAX_BYTES)reject('invalid output budget');
 const pos={at:4},length=uint(packed,pos,maxOutputBytes);
 if(pos.at>=packed.length)reject('missing transform depth');
 const n=packed[pos.at++];
 if(n<1||n>3)reject('invalid transform depth');
 if(pos.at+n>=packed.length)reject('truncated steps');
 const ops=[];
 for(let i=0;i<n;i++){
  const code=packed[pos.at++];
  if(code<1||code>5)reject('invalid transform code');
  ops.push(code);
 }
 const mode=packed[pos.at++];
 const payload=packed.subarray(pos.at);
 if(payload.length===0)reject('missing compressed payload');
 let decoded;
 try{
  if(mode===1)decoded=inflateSync(payload,{maxOutputLength:Math.max(1,length)});
  else if(mode===2)decoded=decodeRootReference(payload,maxOutputBytes);
  else reject('unknown leaf codec');
 }catch(error){
  reject('invalid leaf payload: '+String(error.message).slice(0,100));
 }
 if(decoded.length!==length)reject('incorrect decoded length');
 for(let i=ops.length-1;i>=0;i--)decoded=reverseStep(decoded,ops[i]);
 return decoded;
}
/**
 * Reference receipt from an independently coded decoder. This confirms exact
 * local reconstruction, NOT independent organizational QA or production safety.
 */
export function verifyGraphAgainstOriginal(packed,original,{datasetId='sample'}={}){
 if(!Buffer.isBuffer(original)||original.length>MAX_BYTES)reject('invalid original');
 if(typeof datasetId!=='string'||!/^[a-z][a-z0-9._:-]{0,95}$/.test(datasetId))reject('invalid dataset');
 const restored=referenceDecodeGraph(packed);
 if(!restored.equals(original))reject('reference reconstructed bytes differ from supplied dataset');
 return Object.freeze({
  schema:'mechanicus.math-reproduction-receipt/1',
  datasetId,originalSha256:digest(original),
  encodedSha256:digest(packed),restoredSha256:digest(restored),
  exactByteEquality:true,referenceDecoder:REFERENCE_VERIFIER_ABI,
  independentImplementation:true,independentAgentReviewed:false,
  independentQACompleted:false,productionApproved:false
 });
}

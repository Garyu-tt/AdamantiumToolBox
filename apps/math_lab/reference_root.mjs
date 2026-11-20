/** Separate, bounded, integer-only reference decoder of R01 MLR1. */
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
export function decodeRootReference(packed,maxOutputBytes=MAX_BYTES){
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

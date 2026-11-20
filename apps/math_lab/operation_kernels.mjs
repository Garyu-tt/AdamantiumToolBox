/**
 * Mechanicus Math Lab R03 — fixed, deterministic byte operation kernels.
 *
 * Only operations declared in operation_registry.mjs are executable. No eval,
 * source-code payloads, runtime plugin loading, external calls or mutation.
 * Input and output are byte arrays of identical length.
 */
import {resolveOperation} from './operation_registry.mjs';
const MAX_BYTES=8192;
export function runMathByteOperation(input,operationId){
 if(!Buffer.isBuffer(input)||input.length>MAX_BYTES)throw new TypeError('Expected bounded bytes');
 const meta=resolveOperation(operationId);
 if(meta.kind!=='transform')throw new TypeError('Not a reversible byte operation');
 const inverse=meta.direction==='decode';
 const op=inverse?meta.inverseId:operationId;
 const out=Buffer.alloc(input.length);
 if(op===0x0101){
  if(input.length)out[0]=input[0];
  for(let i=1;i<input.length;i++)
   out[i]=inverse?(out[i-1]^input[i]):(input[i]^input[i-1]);
 }else if(op===0x0102){
  if(input.length)out[0]=input[0];
  for(let i=1;i<input.length;i++)
   out[i]=inverse?((out[i-1]+input[i])&255):((input[i]-input[i-1])&255);
 }else if(op===0x0103){
  if(inverse){
   const even=Math.ceil(input.length/2);
   for(let i=0;i<even;i++)out[2*i]=input[i];
   for(let i=0;i<input.length-even;i++)out[2*i+1]=input[even+i];
  }else{
   let at=0;
   for(let i=0;i<input.length;i+=2)out[at++]=input[i];
   for(let i=1;i<input.length;i+=2)out[at++]=input[i];
  }
 }else if(op===0x0104){
  let at=0;
  for(;at+8<=input.length;at+=8){
   for(let col=0;col<8;col++){
    let b=0;
    for(let row=0;row<8;row++)
     b|=((input[at+row]>>col)&1)<<row;
    out[at+col]=b;
   }
  }
  for(;at<input.length;at++)out[at]=input[at];
 }else if(op===0x0105){
  for(let i=0;i<input.length;i++)out[i]=input[input.length-1-i];
 }else throw new TypeError('Missing math operation kernel');
 return out;
}

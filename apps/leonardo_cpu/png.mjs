import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const size=64,signature=Buffer.from('89504e470d0a1a0a','hex');
function crc(bytes){
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function chunk(type,body){
 const tag=Buffer.from(type),n=Buffer.alloc(4),sum=Buffer.alloc(4);
 n.writeUInt32BE(body.length);sum.writeUInt32BE(crc(Buffer.concat([tag,body])));
 return Buffer.concat([n,tag,body,sum]);
}
export function iconPNG(prompt,variant=''){
 const seed=createHash('sha256').update(prompt+'|'+variant).digest();
 const data=Buffer.alloc((size*4+1)*size);
 const bg=[seed[0]%80+30,seed[1]%80+30,seed[2]%80+30];
 const fg=[seed[8]%96+154,seed[9]%96+154,seed[10]%96+154];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*(size*4+1)+1+x*4,dx=x-31.5,dy=y-31.5,r=Math.sqrt(dx*dx+dy*dy);
  const ring=r>23&&r<27,axis=Math.abs(dx+dy*(seed[3]%3+1)/3)<3&&r<20;
  const spot=Math.hypot(dx-(seed[4]%17-8),dy-(seed[5]%17-8))<7;
  const on=ring||axis||spot;
  for(let c=0;c<3;c++)data[i+c]=on?fg[c]:bg[c];
  data[i+3]=r<30?255:0;
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([signature,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]);
}

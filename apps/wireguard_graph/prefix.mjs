import {isIP} from 'node:net';
export function decodePrefix(cidr){
 if(typeof cidr!=='string'||cidr.length>64)return null;
 const [address,len,extra]=cidr.split('/');
 if(extra!==undefined||!/^\d{1,3}$/.test(len||''))return null;
 const family=isIP(address),bits=family===4?32:family===6?128:0,mask=Number(len);
 if(!bits||mask>bits)return null;
 let words;
 if(family===4)words=address.split('.').map(Number);
 else{
  if(address.includes('.'))return null;
  const halves=address.split('::');
  if(halves.length>2)return null;
  const left=halves[0]?halves[0].split(':'):[],right=halves.length===2&&halves[1]?halves[1].split(':'):[];
  if(halves.length===1&&left.length!==8)return null;
  const missing=8-left.length-right.length;
  if(missing<0||(halves.length===2&&missing<1))return null;
  words=[...left,...Array(missing).fill('0'),...right].map(x=>parseInt(x,16));
 }
 const width=family===4?8:16;
 const value=words.reduce((acc,v)=>(acc<<BigInt(width))+BigInt(v),0n);
 return {family,bits,mask,value};
}
export function prefixesOverlap(left,right){
 const a=decodePrefix(left),b=decodePrefix(right);
 if(!a||!b)return null;
 if(a.family!==b.family)return false;
 const common=Math.min(a.mask,b.mask),shift=BigInt(a.bits-common);
 return (a.value>>shift)===(b.value>>shift);
}

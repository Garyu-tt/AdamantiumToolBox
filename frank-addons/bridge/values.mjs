// FRANK-VALUES-1: JSON values plus explicit lossless i64/u64 and binary tags.
const reject=()=>{throw Error('invalid_frank_value');};
const forbidden=new Set(['__proto__','constructor','prototype']);
const signed=/^(?:0|-[1-9][0-9]*|[1-9][0-9]*)$/;
const unsigned=/^(?:0|[1-9][0-9]*)$/;
function tag(value,keys){
 if(keys.length!==2||!keys.includes('$frank')||!keys.includes('value')||
  typeof value.value!=='string')reject();
 if(value.$frank==='bytes'){
  const input=value.value;
  if(input.length>16384||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)||
   Buffer.from(input,'base64').toString('base64')!==input)reject();
  return;
 }
 if(value.$frank!=='i64'&&value.$frank!=='u64')reject();
 if(value.value.length>21||!(value.$frank==='i64'?signed:unsigned).test(value.value))reject();
 const n=BigInt(value.value);
 if(value.$frank==='i64'&&(n<-(1n<<63n)||n>=(1n<<63n)))reject();
 if(value.$frank==='u64'&&(n<0n||n>=(1n<<64n)))reject();
}
export function assertFrankValue(value){
 const seen=new WeakSet();let nodes=0;
 function walk(v,depth){
  if(depth>16||++nodes>2048)reject();
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'){
   if(!Number.isFinite(v)||(Number.isInteger(v)&&!Number.isSafeInteger(v)))reject();
   return;
  }
  if(typeof v!=='object'||seen.has(v))reject();
  seen.add(v);
  if(Array.isArray(v)){
   if(v.length>256||Object.keys(v).length!==v.length)reject();
   for(const item of v)walk(item,depth+1);
  }else{
   const proto=Object.getPrototypeOf(v);
   if(proto!==Object.prototype&&proto!==null)reject();
   const keys=Object.keys(v);
   if(keys.length>256||keys.some(k=>forbidden.has(k)||k.length>128))reject();
   if(Object.getOwnPropertySymbols(v).length)reject();
   for(const k of keys){
    const d=Object.getOwnPropertyDescriptor(v,k);
    if(!d||!('value' in d))reject();
   }
   if(Object.hasOwn(v,'$frank'))tag(v,keys);
   else for(const k of keys)walk(v[k],depth+1);
  }
  seen.delete(v);
 }
 walk(value,0);
 const json=JSON.stringify(value);
 if(!json||Buffer.byteLength(json,'utf8')>32768)reject();
 return value;
}
export const frankI64=value=>assertFrankValue({$frank:'i64',value:String(value)});
export const frankBytes=bytes=>assertFrankValue({
 $frank:'bytes',value:Buffer.from(bytes).toString('base64')});

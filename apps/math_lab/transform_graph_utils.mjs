/** Bounded reversible byte transform helpers for MLG2 research search. */
const MAGIC=Buffer.from('MLG2','ascii');
function checkInt(x,min,max,label){
 if(!Number.isSafeInteger(x)||x<min||x>max)throw new TypeError('Transform search invalid '+label);
 return x;
}
function numberBytes(value){
 checkInt(value,0,Number.MAX_SAFE_INTEGER,'varint');
 const result=[];
 do{let b=value%128;value=Math.floor(value/128);result.push(b+(value>0?128:0));}while(value);
 return Buffer.from(result);
}
export function applyStep(input,op){
 const out=Buffer.allocUnsafe(input.length);
 if(op===1||op===2){
  if(input.length)out[0]=input[0];
  for(let i=1;i<input.length;i++){
   if(op===1)out[i]=input[i]^input[i-1];
   else out[i]=(input[i]-input[i-1]+256)&255;
  }
 }else if(op===3){
  let j=0;
  for(let i=0;i<input.length;i+=2)out[j++]=input[i];
  for(let i=1;i<input.length;i+=2)out[j++]=input[i];
 }else if(op===4){
  let i=0;
  for(;i+8<=input.length;i+=8){
   for(let bit=0;bit<8;bit++){
    let v=0;
    for(let row=0;row<8;row++)v|=((input[i+row]>>bit)&1)<<row;
    out[i+bit]=v;
   }
  }
  for(;i<input.length;i++)out[i]=input[i];
 }else if(op===5){
  for(let i=0;i<input.length;i++)out[i]=input[input.length-1-i];
 }else throw new TypeError('Unsupported transform step');
 return out;
}
export function envelope(inputBytes,steps,codec,payload){
 return Buffer.concat([MAGIC,numberBytes(inputBytes),Buffer.from([steps.length,...steps,codec]),payload]);
}
export function validOpts(opts){
 if(opts===null||typeof opts!=='object'||Array.isArray(opts))throw new TypeError('Invalid search options');
 const allowed=new Set(['maxDepth','maxStates','maxRootCalls','maxRootEvaluations','degrees','modelBytes']);
 for(const name of Object.keys(opts))if(!allowed.has(name))throw new TypeError('Unknown transform search option '+name);
 const maxDepth=checkInt(opts.maxDepth??2,0,3,'depth');
 const maxStates=checkInt(opts.maxStates??24,1,64,'states');
 const maxRootCalls=checkInt(opts.maxRootCalls??5,0,32,'root calls');
 const maxRootEvaluations=checkInt(opts.maxRootEvaluations??12,1,40,'root evaluations');
 const degrees=opts.degrees??[2,3,4,8,16,32,64,256,1000,1024,4096];
 if(!Array.isArray(degrees)||degrees.length>16||
   !degrees.every(k=>Number.isSafeInteger(k)&&k>=2&&k<=32768))throw new TypeError('Invalid degree set');
 const model=opts.modelBytes??{};
 if(model===null||typeof model!=='object'||Array.isArray(model))throw new TypeError('Invalid model costs');
 for(const key of Object.keys(model))if(!['zlib','root','graph'].includes(key))throw new TypeError('Unknown model cost');
 const modelBytes={
  zlib:checkInt(model.zlib??0,0,1_000_000,'zlib model cost'),
  root:checkInt(model.root??0,0,1_000_000,'root model cost'),
  graph:checkInt(model.graph??0,0,1_000_000,'graph model cost')
 };
 return {maxDepth,maxStates,maxRootCalls,maxRootEvaluations,degrees,modelBytes};
}

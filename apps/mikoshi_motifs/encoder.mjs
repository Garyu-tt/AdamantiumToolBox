// Auditory shape encoder: FFT bands from two windows, not phoneme/word labels.
const EDGES=[110,200,330,470,650,900,1200,1550,2000,2600,3400,4500];
const SIZE=1024, RATE=12000;
function fft(samples,start){
 const re=new Float64Array(SIZE),im=new Float64Array(SIZE);
 for(let i=0;i<SIZE;i++)re[i]=samples[start+i]*(.5-.5*Math.cos(2*Math.PI*i/(SIZE-1)));
 for(let i=1,j=0;i<SIZE;i++){
  let bit=SIZE>>1;
  while(j&bit){j^=bit;bit>>=1;}
  j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];}
 }
 for(let len=2;len<=SIZE;len*=2){
  const angle=-2*Math.PI/len;
  for(let off=0;off<SIZE;off+=len)for(let j=0;j<len/2;j++){
   const c=Math.cos(angle*j),s=Math.sin(angle*j);
   const a=off+j,b=a+len/2;
   const tr=re[b]*c-im[b]*s,ti=re[b]*s+im[b]*c;
   re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;
  }
 }
 const bands=Array(EDGES.length-1).fill(0);
 for(let k=1;k<SIZE/2;k++){
  const hz=k*RATE/SIZE,power=re[k]*re[k]+im[k]*im[k];
  for(let b=0;b<bands.length;b++)if(hz>=EDGES[b]&&hz<EDGES[b+1]){
   bands[b]+=power;break;
  }
 }
 const total=bands.reduce((a,b)=>a+b,0);
 if(total<1e-8)throw Error('silent_audio_frame');
 return bands.map(b=>Math.sqrt(b/total));
}
export function encode(samples,rate=RATE){
 if(rate!==RATE||!Array.isArray(samples)||samples.length<2200||samples.length>4096||
  !samples.every(x=>Number.isFinite(x)&&Math.abs(x)<=1))
  throw Error('invalid_audio_frame');
 const rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
 if(rms<.012)throw Error('silent_audio_frame');
 const start=Math.floor((samples.length-SIZE)/2);
 return {schema:'mikoshi.auditory.shape.v1',vector:[
  ...fft(samples,0),...fft(samples,start)],rms:+rms.toFixed(5)};
}
export function distance(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==22||b.length!==22||
  ![...a,...b].every(x=>Number.isFinite(x)&&x>=0&&x<=1.01))
  throw Error('invalid_auditory_vector');
 return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/22);
}

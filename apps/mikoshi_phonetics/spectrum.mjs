// Hann-window FFT and normalized spectral bands. No transcripts or labels.
const BOUNDS=[180,310,460,650,880,1190,1570,2070,2730,3590,4700];
function fft(samples){
 const n=1024,re=new Float64Array(n),im=new Float64Array(n);
 const start=Math.floor((samples.length-n)/2);
 for(let i=0;i<n;i++)re[i]=samples[start+i]*
  (.5-.5*Math.cos(2*Math.PI*i/(n-1)));
 for(let i=1,j=0;i<n;i++){
  let bit=n>>1;
  while(j&bit){j^=bit;bit>>=1;}
  j^=bit;
  if(i<j){[re[i],re[j]]=[re[j],re[i]];}
 }
 for(let len=2;len<=n;len<<=1){
  const a=-2*Math.PI/len;
  for(let off=0;off<n;off+=len)for(let j=0;j<len/2;j++){
   const c=Math.cos(a*j),s=Math.sin(a*j);
   const x=off+j,y=x+len/2;
   const tr=re[y]*c-im[y]*s,ti=re[y]*s+im[y]*c;
   re[y]=re[x]-tr;im[y]=im[x]-ti;
   re[x]+=tr;im[x]+=ti;
  }
 }
 return [re,im];
}
export function spectrum(samples,rate=12000){
 if(!Array.isArray(samples)||samples.length<1024||samples.length>4096||
  !Number.isInteger(rate)||rate<8000||rate>48000||
  !samples.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1))
  throw Error('invalid_audio_frame');
 const [re,im]=fft(samples),e=Array(BOUNDS.length-1).fill(0);
 for(let k=1;k<re.length/2;k++){
  const hz=k*rate/re.length,power=re[k]**2+im[k]**2;
  for(let b=0;b<e.length;b++){
   if(hz>=BOUNDS[b]&&hz<BOUNDS[b+1]){e[b]+=power;break;}
  }
 }
 const total=e.reduce((a,b)=>a+b,0);
 if(total<1e-8)throw Error('silent_audio_frame');
 return e.map(v=>Math.sqrt(v/total));
}
export function distance(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==BOUNDS.length-1||
  b.length!==a.length||![...a,...b].every(x=>Number.isFinite(x)&&x>=0&&x<=1.01))
  throw Error('invalid_spectral_vector');
 return a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length;
}

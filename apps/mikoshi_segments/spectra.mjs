// Coarse, CPU-only auditory shape: independent FFT, no speech labels or LLM.
const N=1024,BOUND=[100,350,650,900,1250,1650,2200,2900,3900,4900];
export function shape(samples){
 if(!Array.isArray(samples)||samples.length!==2400||
  !samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=1))
  throw Error('invalid_event_audio');
 const re=new Float64Array(N),im=new Float64Array(N),start=688;
 for(let i=0;i<N;i++)re[i]=samples[start+i]*
  (.5-.5*Math.cos(2*Math.PI*i/(N-1)));
 for(let i=1,j=0;i<N;i++){
  let bit=N>>1;
  while(j&bit){j^=bit;bit>>=1;}
  j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];}
 }
 for(let len=2;len<=N;len<<=1){
  const a=-2*Math.PI/len;
  for(let offset=0;offset<N;offset+=len){
   const cos=Math.cos(a),sin=Math.sin(a);let wr=1,wi=0;
   for(let k=0;k<len/2;k++){
    const x=offset+k,y=x+len/2;
    const tr=wr*re[y]-wi*im[y],ti=wr*im[y]+wi*re[y];
    re[y]=re[x]-tr;im[y]=im[x]-ti;
    re[x]+=tr;im[x]+=ti;
    const next=wr*cos-wi*sin;wi=wr*sin+wi*cos;wr=next;
   }
  }
 }
 const bands=Array(BOUND.length-1).fill(0);
 for(let k=1;k<N/2;k++){
  const hz=k*12000/N,energy=re[k]*re[k]+im[k]*im[k];
  for(let b=0;b<bands.length;b++)if(hz>=BOUND[b]&&hz<BOUND[b+1]){
   bands[b]+=energy;break;
  }
 }
 const total=bands.reduce((a,b)=>a+b,0);
 if(total<1e-7)throw Error('silent_audio_event');
 return bands.map(v=>Math.sqrt(v/total));
}
export function delta(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==9||b.length!==9)
  throw Error('invalid_shape');
 return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/9);
}

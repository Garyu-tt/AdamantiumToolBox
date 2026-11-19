// CPU-first acoustic features, not ASR or semantic understanding.
export function analyze(samples,rate=16000){
 if(!Array.isArray(samples)||samples.length<320||samples.length>8192)throw Error('pcm_frame_length');
 if(!Number.isInteger(rate)||rate<8000||rate>48000)throw Error('sample_rate');
 let energy=0,cross=0;
 for(let i=0;i<samples.length;i++){
  const v=samples[i];
  if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1)throw Error('pcm_value');
  energy+=v*v;
  if(i>0&&(v>=0)!==(samples[i-1]>=0))cross++;
 }
 const rms=Math.sqrt(energy/samples.length),zcr=cross/(samples.length-1);
 let best=0,lag=0;
 if(rms>.012){
  const min=Math.max(2,Math.floor(rate/450));
  const max=Math.min(Math.floor(rate/75),Math.floor(samples.length/3));
  for(let k=min;k<=max;k++){
   let dot=0,a=0,b=0;
   for(let i=k;i<samples.length;i++){
    dot+=samples[i]*samples[i-k];a+=samples[i]**2;b+=samples[i-k]**2;
   }
   const corr=dot/Math.sqrt(a*b+1e-12);
   if(corr>best){best=corr;lag=k;}
  }
 }
 const pitch=lag&&best>.45?Math.round(rate/lag):null;
 return {schema:'mikoshi.audio.features.v1',rms:+rms.toFixed(5),
  zeroCrossRate:+zcr.toFixed(5),pitchHz:pitch,pitchConfidence:+best.toFixed(3),
  activity:rms>.015?'active':'quiet',
  vector:[Math.min(1,rms*5),Math.min(1,zcr*12),pitch?Math.min(1,pitch/450):0]};
}

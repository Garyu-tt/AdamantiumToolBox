// In-memory only: resample an approved short recording to a bounded PCM lesson.
export function lessonPcm(channel,rate){
 if(!channel||typeof channel.length!=='number'||channel.length<1024||
  channel.length>144000||!Number.isFinite(rate)||rate<8000||rate>96000)
  throw Error('invalid_microphone_audio');
 const length=Math.floor(channel.length*12000/rate),resampled=new Float32Array(length);
 for(let i=0;i<length;i++){
  const source=i*rate/12000,j=Math.floor(source),t=source-j;
  const a=channel[Math.min(j,channel.length-1)];
  const b=channel[Math.min(j+1,channel.length-1)];
  if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('invalid_microphone_audio');
  resampled[i]=Math.max(-1,Math.min(1,a+(b-a)*t));
 }
 const width=2400;
 if(length<width)throw Error('microphone_audio_too_short');
 let bestEnergy=-1,bestStart=0;
 for(let start=0;start+width<=length;start+=120){
  let sum=0;
  for(let j=start;j<start+width;j++)sum+=resampled[j]*resampled[j];
  if(sum>bestEnergy){bestEnergy=sum;bestStart=start;}
 }
 if(bestEnergy/width<0.00015)throw Error('microphone_sample_too_quiet');
 return Array.from(resampled.subarray(bestStart,bestStart+width));
}

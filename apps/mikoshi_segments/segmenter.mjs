import {shape,delta} from './spectra.mjs';
// Fixed 12-kHz PCM, 20-ms energy gates, 200-ms memory-compatible windows.
const RATE=12000,FRAME=240,WINDOW=2400,HOP=2400,MAX=12;
export function segment(samples,rate=RATE){
 if(rate!==RATE||!Array.isArray(samples)||samples.length<4800||
  samples.length>48000||
  !samples.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1))
  throw Error('invalid_stream_audio');
 const rms=[];
 for(let i=0;i+FRAME<=samples.length;i+=FRAME){
  let sum=0;for(let k=i;k<i+FRAME;k++)sum+=samples[k]*samples[k];
  rms.push(Math.sqrt(sum/FRAME));
 }
 const sorted=[...rms].sort((a,b)=>a-b);
 const floor=sorted[Math.floor(sorted.length*.1)]||0;
 const gate=Math.max(.018,Math.min(.05,floor*.75+.012));
 const active=rms.map(v=>v>=gate);
 // Fill isolated 20-40ms dips; preserve actual pauses of 60ms or longer.
 for(let i=1;i<active.length-1;i++){
  if(active[i])continue;
  let n=1;while(i+n<active.length&&!active[i+n]&&n<=2)n++;
  if(n<=2&&i+n<active.length&&active[i-1]&&active[i+n]){
   for(let j=i;j<i+n;j++)active[j]=true;i+=n-1;
  }
 }
 const regions=[],events=[];
 for(let i=0;i<active.length;){
  if(!active[i]){i++;continue;}
  const start=i;while(i<active.length&&active[i])i++;
  const end=i;
  if((end-start)*FRAME>=1600)regions.push([start*FRAME,end*FRAME]);
 }
 for(const [start,end] of regions){
  let prev=null;
  for(let cursor=start;cursor<end;cursor+=HOP){
   const center=Math.min(end,Math.max(start+WINDOW/2,cursor+WINDOW/2));
   const windowStart=Math.max(0,Math.min(samples.length-WINDOW,
    Math.round(center-WINDOW/2)));
   const audio=samples.slice(windowStart,windowStart+WINDOW);
   const v=shape(audio);
   // Adjacent near-identical windows represent one longer acoustic event.
   if(prev&&delta(prev.vector,v)<.055){prev.durationMs+=200;continue;}
   if(events.length>=MAX)throw Error('event_budget_exceeded');
   const timeMs=Math.round(cursor/RATE*1000);
   const event={timeMs,durationMs:200,gapMs:events.length?
    timeMs-events.at(-1).timeMs:0,samples:audio,vector:v};
   events.push(event);prev=event;
  }
 }
 return {schema:'mikoshi.auditory.events.v1',sampleRate:RATE,
  durationMs:Math.floor(samples.length/RATE*1000),activityThreshold:+gate.toFixed(5),
  events:events.map(({timeMs,durationMs,gapMs,samples})=>({
   timeMs,durationMs,gapMs,samples})),
  detected:events.length,regions:regions.length,model:'none',retained:false};
}

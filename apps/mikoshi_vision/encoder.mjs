// Tiny RGB-frame change encoder. Only anonymous numerical events, no labels.
const SIDE=8,COUNT=SIDE*SIDE,CHANNELS=3;
function checkFrame(f){
 if(!f||!Number.isInteger(f.timeMs)||f.timeMs<0||f.timeMs>4000||
  !Array.isArray(f.pixels)||f.pixels.length!==COUNT*CHANNELS||
  !f.pixels.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1))
  throw Error('invalid_visual_frame');
}
export function analyze(frames){
 if(!Array.isArray(frames)||frames.length<2||frames.length>12)
  throw Error('invalid_visual_stream');
 frames.forEach(checkFrame);
 for(let i=1;i<frames.length;i++)
  if(frames[i].timeMs<=frames[i-1].timeMs)
   throw Error('invalid_visual_timeline');
 const events=[];
 for(let t=1;t<frames.length;t++){
  const a=frames[t-1].pixels,b=frames[t].pixels;
  let count=0,x=0,y=0,brightness=0,deltaLight=0,energy=0;
  const rgb=[0,0,0],change=[0,0,0];
  for(let i=0;i<COUNT;i++){
   const p=i*3,d=[0,1,2].map(k=>Math.abs(b[p+k]-a[p+k]));
   if(Math.max(...d)<.14)continue;
   count++;x+=i%SIDE;y+=Math.floor(i/SIDE);
   for(let k=0;k<3;k++){rgb[k]+=b[p+k];change[k]+=d[k];energy+=d[k];}
   const before=(a[p]+a[p+1]+a[p+2])/3;
   const after=(b[p]+b[p+1]+b[p+2])/3;
   brightness+=after;deltaLight+=after-before;
  }
  if(count<2||energy/(COUNT*3)<.008)continue;
  const vector=[x/(count*7),y/(count*7),count/COUNT,
   ...rgb.map(v=>v/count),...change.map(v=>v/count),
   Math.min(1,energy/(count*3))];
  const kind=deltaLight/count>.06?'appear':
   deltaLight/count<-.06?'disappear':'change';
  events.push({timeMs:frames[t].timeMs,kind,vector:
   vector.map(v=>+Math.max(0,Math.min(1,v)).toFixed(6))});
 }
 return {schema:'mikoshi.visual.events.v1',width:8,height:8,
  frames:frames.length,events,detected:events.length,
  model:'none',persisted:false};
}

// Coarse anonymous 8x8 foreground tracks; no object/face recognition.
const PIX=64,MAX=8,THRESHOLD=.20;
function framesOK(frames){
 if(!Array.isArray(frames)||frames.length<2||frames.length>12)
  throw Error('invalid_tracking_frames');
 let previous=-1;
 for(const f of frames){
  if(!f||!Number.isInteger(f.timeMs)||f.timeMs<=previous||
   f.timeMs<0||f.timeMs>4000||!Array.isArray(f.pixels)||
   f.pixels.length!==PIX*3||!f.pixels.every(x=>Number.isFinite(x)&&x>=0&&x<=1))
   throw Error('invalid_tracking_frame');
  previous=f.timeMs;
 }
}
function objects(baseline,current){
 const active=new Uint8Array(PIX),visited=new Uint8Array(PIX);
 for(let i=0;i<PIX;i++){
  const k=i*3;
  if(Math.max(...[0,1,2].map(c=>Math.abs(
   baseline[k+c]-current[k+c])))>=THRESHOLD)active[i]=1;
 }
 const components=[];
 for(let i=0;i<PIX;i++){
  if(!active[i]||visited[i])continue;
  const queue=[i];visited[i]=1;let count=0,x=0,y=0,rgb=[0,0,0];
  for(let n=0;n<queue.length;n++){
   const p=queue[n],px=p%8,py=Math.floor(p/8);
   x+=px;y+=py;count++;
   for(let k=0;k<3;k++)rgb[k]+=current[p*3+k];
   for(const neighbor of [p-8,p+8,...(px>0?[p-1]:[]),
    ...(px<7?[p+1]:[])]){
    if(neighbor<0||neighbor>=PIX||!active[neighbor]||visited[neighbor])
     continue;
    visited[neighbor]=1;queue.push(neighbor);
   }
  }
  if(count>=2)components.push({
   x:+(x/count).toFixed(4),y:+(y/count).toFixed(4),
   area:count,rgb:rgb.map(v=>+(v/count).toFixed(4))});
 }
 return components.sort((a,b)=>b.area-a.area||a.x-b.x).slice(0,MAX);
}
const metric=(a,b)=>{
 const dist=Math.hypot(a.x-b.x,a.y-b.y);
 const color=Math.hypot(...a.rgb.map((v,i)=>v-b.rgb[i]));
 return dist<=2.5&&color<=.6?dist+color*2:Infinity;
};
export function track(frames){
 framesOK(frames);
 const memory=[],events=[];let next=1;
 const baseline=frames[0].pixels;
 for(let frameIndex=1;frameIndex<frames.length;frameIndex++){
  const {timeMs,pixels}=frames[frameIndex],found=objects(baseline,pixels);
  const candidates=[];
  for(let j=0;j<found.length;j++)for(const prev of memory){
   if(frameIndex-prev.lastIndex>2)continue;
   const cost=metric(prev,found[j]);
   if(Number.isFinite(cost))candidates.push({cost,j,id:prev.id});
  }
  candidates.sort((a,b)=>a.cost-b.cost||a.id.localeCompare(b.id)||a.j-b.j);
  const bound=new Set(),used=new Set();
  for(const c of candidates){
   if(bound.has(c.id)||used.has(c.j))continue;
   const item=memory.find(x=>x.id===c.id),sample=found[c.j];
   const moved=Math.hypot(item.x-sample.x,item.y-sample.y)>.6;
   Object.assign(item,sample,{lastIndex:frameIndex,lastTimeMs:timeMs});
   item.observations++;
   item.path.push({timeMs,x:sample.x,y:sample.y});
   if(moved)events.push({timeMs,id:item.id,kind:'move'});
   bound.add(c.id);used.add(c.j);
  }
  for(let j=0;j<found.length;j++)if(!used.has(j)){
   if(memory.length>=MAX)continue;
   const item={id:'t'+String(next++).padStart(5,'0'),...found[j],
    firstTimeMs:timeMs,lastTimeMs:timeMs,lastIndex:frameIndex,
    observations:1,path:[{timeMs,x:found[j].x,y:found[j].y}]};
   memory.push(item);events.push({timeMs,id:item.id,kind:'appear'});
  }
 }
 return {schema:'mikoshi.visual.tracks.v1',
  tracks:memory.map(({id,firstTimeMs,lastTimeMs,observations,path,area})=>
   ({id,firstTimeMs,lastTimeMs,observations,path,area})),
  events,frames:frames.length,model:'coarse-background-blob',
  identityVerified:false,retained:false};
}

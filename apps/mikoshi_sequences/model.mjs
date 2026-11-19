// Ordered acoustic motif memory with coarse timing; not words or grammar.
const PATTERNS=1024,PAUSE=900,MAX_EVENTS=24;
const motif=id=>typeof id==='string'&&/^m[0-9]{5,7}$/.test(id);
export const gapBand=ms=>ms<180?'quick':ms<450?'medium':ms<PAUSE?'slow':'boundary';
function eventsValid(events,min,max){
 if(!Array.isArray(events)||events.length<min||events.length>max||
  !events.every(e=>e&&motif(e.id)&&Number.isInteger(e.gapMs)&&
   e.gapMs>=0&&e.gapMs<=5000)||events[0].gapMs!==0)throw Error('invalid_sequence');
}
const key=events=>events.map((e,i)=>(i?gapBand(e.gapMs)+'/':'')+e.id).join('>');
function phrases(events){
 const phrases=[];let seq=[];
 for(const e of events){
  if(e.gapMs>=PAUSE&&seq.length){phrases.push(seq);seq=[];}
  seq.push({...e,gapMs:seq.length?e.gapMs:0});
 }
 if(seq.length)phrases.push(seq);
 return phrases;
}
export function initialize(){return {schema:'mikoshi.sequence.v1',episodes:0,
 observations:0,patterns:[]};}
export function validate(state){
 if(!state||state.schema!=='mikoshi.sequence.v1'||
  !Number.isSafeInteger(state.episodes)||state.episodes<0||
  !Number.isSafeInteger(state.observations)||state.observations<0||
  !Array.isArray(state.patterns)||state.patterns.length>PATTERNS)
  throw Error('invalid_sequence_state');
 const keys=new Set();
 for(const p of state.patterns){
  if(!p||!Array.isArray(p.events)||p.events.length<2||p.events.length>4||
   !Number.isSafeInteger(p.count)||p.count<1||p.count>1000000)
   throw Error('invalid_sequence_state');
  eventsValid(p.events,2,4);
  if(p.events.some((e,i)=>i>0&&e.gapMs>=PAUSE)||p.key!==key(p.events)||
   keys.has(p.key))throw Error('invalid_sequence_state');
  keys.add(p.key);
 }
}
export function learn(state,events){
 validate(state);eventsValid(events,2,MAX_EVENTS);
 const next=structuredClone(state);let updates=0,novel=0;
 for(const phrase of phrases(events)){
  for(let i=1;i<phrase.length;i++)for(let size=2;size<=4&&size<=i+1;size++){
   // Persist timing categories, never source-specific millisecond stamps.
   const representative={quick:90,medium:300,slow:650};
   const seq=phrase.slice(i-size+1,i+1).map((e,j)=>({
    id:e.id,gapMs:j?representative[gapBand(e.gapMs)]:0}));
   const signature=key(seq);
   let item=next.patterns.find(p=>p.key===signature);
   if(!item){
    if(next.patterns.length>=PATTERNS)throw Error('sequence_capacity_reached');
    item={key:signature,events:seq,count:0};
    next.patterns.push(item);novel++;
   }
   if(item.count>=1000000)throw Error('sequence_observation_limit');
   item.count++;updates++;
  }
 }
 if(!updates)return {state:next,result:{updated:false,reason:'no_contiguous_pair'}};
 if(next.episodes>=1000000||next.observations>10000000-events.length)
  throw Error('sequence_observation_limit');
 next.episodes++;next.observations+=events.length;
 return {state:next,result:{updated:true,patterns:next.patterns.length,
  reinforced:updates-novel,discovered:novel,episodes:next.episodes}};
}
export function predict(state,context){
 validate(state);eventsValid(context,1,3);
 if(context.some((e,i)=>i>0&&e.gapMs>=PAUSE))throw Error('sequence_boundary');
 for(let n=context.length;n>=1;n--){
  const suffix=context.slice(-n).map((e,i)=>({id:e.id,gapMs:i?e.gapMs:0}));
  const prefix=key(suffix);
  const matches=state.patterns.filter(p=>p.events.length===n+1&&
   key(p.events.slice(0,n))===prefix);
  if(!matches.length)continue;
  const total=matches.reduce((s,p)=>s+p.count,0);
  return {schema:'mikoshi.sequence.prediction.v1',context:prefix,
   matchedOrder:n,examples:total,candidates:matches.map(p=>({
    nextId:p.events[n].id,gapBand:gapBand(p.events[n].gapMs),
    count:p.count,share:+(p.count/total).toFixed(4)}))
    .sort((a,b)=>b.count-a.count||a.nextId.localeCompare(b.nextId))};
 }
 return {schema:'mikoshi.sequence.prediction.v1',matchedOrder:0,
  examples:0,candidates:[],reason:'unlearned_context'};
}
export function catalog(state){
 validate(state);return {schema:'mikoshi.sequence.catalog.v1',
  episodes:state.episodes,observations:state.observations,
  patterns:state.patterns.length,
  frequent:state.patterns.filter(p=>p.count>=2).sort((a,b)=>b.count-a.count)
   .slice(0,12).map(p=>({ids:p.events.map(e=>e.id),
    timing:p.events.slice(1).map(e=>gapBand(e.gapMs)),count:p.count}))};
}

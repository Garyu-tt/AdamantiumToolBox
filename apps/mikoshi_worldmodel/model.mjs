// Online experience-based acoustic predictor; no LLM, voice assets or audio.
const MAX=96,UUID=/^[0-9a-f-]{36}$/;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function motor(m){
 if(!m||!Number.isInteger(m.f1)||!Number.isInteger(m.f2)||
  m.f1<250||m.f1>1050||m.f2<900||m.f2>3300||m.f2-m.f1<400)
  throw Error('invalid_prediction_motor');
 return {f1:m.f1,f2:m.f2};
}
export function vector(v){
 if(!Array.isArray(v)||v.length!==10||!
  v.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1.01))
  throw Error('invalid_prediction_vector');
 return [...v];
}
const distance=(a,b)=>Math.hypot((a.f1-b.f1)/800,(a.f2-b.f2)/2400);
const error=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0)/10;
export function initialize(){return {schema:'mikoshi.worldmodel.v1',
 observations:0,surprises:0,examples:[],pending:null,lastError:null};}
export function validate(s){
 if(!s||s.schema!=='mikoshi.worldmodel.v1'||
  !Number.isSafeInteger(s.observations)||s.observations<0||
  !Number.isSafeInteger(s.surprises)||s.surprises<0||
  s.surprises>s.observations||!Array.isArray(s.examples)||
  s.examples.length>MAX||
  (s.lastError!==null&&(!Number.isFinite(s.lastError)||
   s.lastError<0||s.lastError>1)))throw Error('invalid_prediction_state');
 for(const e of s.examples){
  motor(e?.motor);vector(e?.vector);
  if(!Number.isSafeInteger(e.count)||e.count<1||e.count>1000000)
   throw Error('invalid_prediction_state');
 }
 const p=s.pending;if(p!==null){
  if(!p||typeof p.id!=='string'||!UUID.test(p.id)||
   !Number.isSafeInteger(p.revision)||p.revision!==s.observations||
   !('predicted' in p))throw Error('invalid_prediction_state');
  motor(p.motor);if(p.predicted!==null)vector(p.predicted);
 }
}
export function estimate(s,candidate){
 validate(s);const target=motor(candidate);
 if(!s.examples.length)return {schema:'mikoshi.worldmodel.estimate.v1',
  ready:false,predicted:null,confidence:0,nearest:null,examples:0};
 const nearby=s.examples.map(e=>({e,d:distance(e.motor,target)}))
  .sort((a,b)=>a.d-b.d).slice(0,4);
 const weights=nearby.map(n=>Math.min(10000,1/(n.d+.015)**2));
 const total=weights.reduce((a,b)=>a+b,0);
 const predicted=Array.from({length:10},(_,i)=>
  clamp(nearby.reduce((sum,n,j)=>sum+weights[j]*n.e.vector[i],0)/total,0,1.01));
 return {schema:'mikoshi.worldmodel.estimate.v1',ready:true,
  predicted,confidence:+(Math.min(1,s.examples.length/6)*
   Math.exp(-4*nearby[0].d)).toFixed(5),
  nearest:+nearby[0].d.toFixed(5),examples:s.examples.length};
}
export function begin(s,candidate,ticket){
 validate(s);if(s.pending)throw Error('prediction_pending');
 if(typeof ticket!=='string'||!UUID.test(ticket))throw Error('invalid_prediction_ticket');
 const m=motor(candidate),pred=estimate(s,m),next=structuredClone(s);
 next.pending={id:ticket,motor:m,predicted:pred.predicted,revision:s.observations};
 return {state:next,result:{...pred,ticket,motor:m}};
}
export function observe(s,ticket,heard){
 validate(s);if(!s.pending||ticket!==s.pending.id)
  throw Error('stale_prediction_ticket');
 const v=vector(heard),next=structuredClone(s),p=next.pending;
 const loss=p.predicted?error(p.predicted,v):null;
 const surprise=loss!==null&&loss>.004;
 let example=next.examples.find(e=>distance(e.motor,p.motor)<.005);
 if(example){
  if(example.count>=1000000)throw Error('prediction_example_limit');
  const weight=1/Math.min(64,example.count+1);
  example.vector=example.vector.map((x,i)=>x+(v[i]-x)*weight);
  example.count++;
 }else{
  if(next.examples.length>=MAX){
   let index=0;
   for(let i=1;i<next.examples.length;i++)
    if(next.examples[i].count<next.examples[index].count)index=i;
   next.examples.splice(index,1);
  }
  next.examples.push({motor:p.motor,vector:v,count:1});
 }
 next.pending=null;next.observations++;
 if(surprise)next.surprises++;
 next.lastError=loss===null?null:+loss.toFixed(8);
 return {state:next,result:{schema:'mikoshi.worldmodel.observation.v1',
  predicted:loss!==null,loss:next.lastError,surprise,
  examples:next.examples.length,observations:next.observations}};
}
export function abort(s,ticket){
 validate(s);
 if(!s.pending||s.pending.id!==ticket)throw Error('stale_prediction_ticket');
 const next=structuredClone(s);next.pending=null;return next;
}
export function status(s){
 validate(s);
 return {schema:'mikoshi.worldmodel.status.v1',
  examples:s.examples.length,observations:s.observations,
  surprises:s.surprises,lastError:s.lastError,
  pendingTicket:s.pending?.id??null,languageModel:false};
}

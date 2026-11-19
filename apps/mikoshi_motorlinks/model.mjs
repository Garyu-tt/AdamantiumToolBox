// Derives motor proposals from scalar auditory error; no TTS or audio imports.
const STEPS=[[180,420],[100,240],[55,135],[28,70],[14,35]];
const DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
const ID=/^m[0-9]{5,7}$/;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function motor(v){
 if(!v||!Number.isInteger(v.f1)||!Number.isInteger(v.f2)||
  v.f1<250||v.f1>1050||v.f2<900||v.f2>3300||v.f2-v.f1<400)
  throw Error('invalid_motor');
 return {f1:v.f1,f2:v.f2};
}
export function initialize(){return {schema:'mikoshi.motorlinks.v1',records:[]};}
export function validate(s){
 if(!s||s.schema!=='mikoshi.motorlinks.v1'||!Array.isArray(s.records)||
  s.records.length>128)throw Error('invalid_motor_state');
 const ids=new Set();
 for(const r of s.records){
  if(!r||!ID.test(r.id)||ids.has(r.id))throw Error('invalid_motor_state');
  ids.add(r.id);motor(r.best);motor(r.origin);
  if((r.bestLoss!==null&&(!Number.isFinite(r.bestLoss)||r.bestLoss<0||r.bestLoss>1))||
   !Number.isInteger(r.stage)||r.stage<0||r.stage>STEPS.length||
   !Number.isInteger(r.cursor)||r.cursor<0||r.cursor>8||
   !Number.isInteger(r.trials)||r.trials<0||r.trials>160||
   typeof r.improved!=='boolean'||typeof r.done!=='boolean')
   throw Error('invalid_motor_state');
 }
}
function fresh(id){
 return {id,best:{f1:560,f2:1640},origin:{f1:560,f2:1640},
  bestLoss:null,stage:0,cursor:0,trials:0,improved:false,done:false};
}
export function propose(state,id){
 validate(state);
 if(typeof id!=='string'||!ID.test(id))throw Error('invalid_motif_id');
 const r=state.records.find(x=>x.id===id)||fresh(id);
 if(r.done||r.stage>=STEPS.length)return {id,ready:false,
  best:r.best,bestLoss:r.bestLoss,trials:r.trials,done:true};
 let candidate=r.origin;
 if(r.cursor>0){
  const [da,db]=DIRECTIONS[r.cursor-1],[a,b]=STEPS[r.stage];
  candidate={f1:clamp(r.origin.f1+da*a,250,1050),
   f2:clamp(r.origin.f2+db*b,900,3300)};
  if(candidate.f2-candidate.f1<400)candidate=r.origin;
 }
 return {schema:'mikoshi.motorlinks.proposal.v1',id,ready:true,
  trial:r.trials,candidate:motor(candidate),bestLoss:r.bestLoss,
  stage:r.stage,completed:r.trials};
}
export function feedback(state,input){
 validate(state);
 const {id,candidate,trial,loss}=input||{};
 if(!Number.isFinite(loss)||loss<0||loss>1||!Number.isSafeInteger(trial))
  throw Error('invalid_motor_feedback');
 const expected=propose(state,id);
 if(!expected.ready||trial!==expected.trial||
  JSON.stringify(motor(candidate))!==JSON.stringify(expected.candidate))
  throw Error('stale_motor_proposal');
 const next=structuredClone(state);
 let r=next.records.find(x=>x.id===id);
 if(!r){
  if(next.records.length>=128)throw Error('motor_capacity_reached');
  r=fresh(id);next.records.push(r);
 }
 const isBetter=r.bestLoss===null||loss+1e-8<r.bestLoss;
 if(isBetter){r.bestLoss=loss;r.best=motor(candidate);r.improved=true;}
 r.trials++;
 if(r.cursor===0){r.cursor=1;r.improved=false;}
 else if(r.cursor<8)r.cursor++;
 else{
  if(!r.improved)r.stage++;
  r.origin={...r.best};r.cursor=1;r.improved=false;
 }
 if(r.stage>=STEPS.length||r.trials>=160)r.done=true;
 return {state:next,result:{id,improved:isBetter,trials:r.trials,
  best:r.best,bestLoss:r.bestLoss,done:r.done,stage:r.stage}};
}
export function catalog(state){
 validate(state);return {schema:'mikoshi.motorlinks.catalog.v1',
  records:state.records.map(r=>({id:r.id,best:r.best,loss:r.bestLoss,
   trials:r.trials,complete:r.done})),capacity:128};
}

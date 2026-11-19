// Bounded adaptive search over timing; identities are opaque acoustic motif IDs.
const OPTIONS=[80,40,60,100,120,140,160],MAX_PAIRS=256;
const id=x=>typeof x==='string'&&/^m[0-9]{5,7}$/.test(x);
export function pair(from,to){
 if(!id(from)||!id(to))throw Error('invalid_motif_pair');
 return from+'>'+to;
}
export function initialize(){return {schema:'mikoshi.transitions.v1',pairs:[]};}
export function validate(s){
 if(!s||s.schema!=='mikoshi.transitions.v1'||!Array.isArray(s.pairs)||
  s.pairs.length>MAX_PAIRS)throw Error('invalid_transition_state');
 const keys=new Set();
 for(const r of s.pairs){
  if(!r||r.key!==pair(r.from,r.to)||keys.has(r.key)||
   !Number.isInteger(r.trials)||r.trials<0||r.trials>OPTIONS.length||
   !Number.isInteger(r.bestMs)||!OPTIONS.includes(r.bestMs)||
   (r.loss!==null&&(!Number.isFinite(r.loss)||r.loss<0||r.loss>1)))
   throw Error('invalid_transition_state');
  keys.add(r.key);
 }
}
export function propose(s,from,to){
 validate(s);const key=pair(from,to),r=s.pairs.find(x=>x.key===key);
 const trials=r?.trials||0;
 return {schema:'mikoshi.transition.proposal.v1',from,to,trials,
  ready:trials<OPTIONS.length,transitionMs:OPTIONS[trials]??(r?.bestMs||80),
  bestMs:r?.bestMs??80,bestLoss:r?.loss??null};
}
export function feedback(s,input){
 validate(s);
 const {from,to,trials,transitionMs,loss}=input||{};
 if(!Number.isFinite(loss)||loss<0||loss>1)throw Error('invalid_transition_reward');
 const expected=propose(s,from,to);
 if(!expected.ready||trials!==expected.trials||
  transitionMs!==expected.transitionMs)throw Error('stale_transition_proposal');
 const copy=structuredClone(s),key=pair(from,to);
 let r=copy.pairs.find(p=>p.key===key);
 if(!r){
  if(copy.pairs.length>=MAX_PAIRS)throw Error('transition_capacity_reached');
  r={key,from,to,trials:0,bestMs:80,loss:null};copy.pairs.push(r);
 }
 const improved=r.loss===null||loss+1e-8<r.loss;
 if(improved){r.loss=loss;r.bestMs=transitionMs;}
 r.trials++;
 return {state:copy,result:{from,to,trials:r.trials,improved,
  bestMs:r.bestMs,bestLoss:r.loss,complete:r.trials===OPTIONS.length}};
}
export function catalog(s){
 validate(s);return {schema:'mikoshi.transition.catalog.v1',capacity:MAX_PAIRS,
  pairs:s.pairs.map(r=>({from:r.from,to:r.to,trials:r.trials,
   bestMs:r.bestMs,bestLoss:r.loss,complete:r.trials===OPTIONS.length}))};
}

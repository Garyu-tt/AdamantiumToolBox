// Generates and ranks TESTABLE acoustic motor questions, never executes them.
// Stateless, deterministic, no language model or audio samples in this plugin.
const OFFSETS=[[-1,0],[1,0],[0,-1],[0,1],
 [-1,-1],[-1,1],[1,-1],[1,1]];
export function motor(m){
 if(!m||!Number.isInteger(m.f1)||!Number.isInteger(m.f2)||
  m.f1<250||m.f1>1050||m.f2<900||m.f2>3300||m.f2-m.f1<400)
  throw Error('invalid_hypothesis_motor');
 return {f1:m.f1,f2:m.f2};
}
export function generate(base,stepF1=80,stepF2=180){
 const start=motor(base);
 if(!Number.isInteger(stepF1)||stepF1<20||stepF1>180||
  !Number.isInteger(stepF2)||stepF2<40||stepF2>420)
  throw Error('invalid_hypothesis_steps');
 const candidates=[],seen=new Set();
 for(const [da,db] of OFFSETS){
  const m={f1:start.f1+da*stepF1,f2:start.f2+db*stepF2};
  try{motor(m);}catch{continue;}
  const id=m.f1+':'+m.f2;
  if(seen.has(id))continue;
  seen.add(id);candidates.push(m);
 }
 if(!candidates.length)throw Error('hypothesis_search_exhausted');
 return {schema:'mikoshi.hypothesis.candidates.v1',
  base:start,candidates,stepF1,stepF2,model:'none'};
}
function option(o){
 const m=motor(o?.motor),e=o?.estimate;
 if(!e||typeof e.ready!=='boolean'||!Number.isInteger(e.examples)||
  e.examples<0||e.examples>96)throw Error('invalid_hypothesis_estimate');
 if(e.ready){
  if(!Number.isFinite(e.confidence)||e.confidence<0||e.confidence>1||
   !Number.isFinite(e.nearest)||e.nearest<0||e.nearest>2||
   !Array.isArray(e.predicted)||e.predicted.length!==10||
   !e.predicted.every(v=>Number.isFinite(v)&&v>=0&&v<=1.01))
   throw Error('invalid_hypothesis_estimate');
 }else if(e.predicted!==null||e.confidence!==0)
  throw Error('invalid_hypothesis_estimate');
 return {motor:m,estimate:e};
}
export function rank(options){
 if(!Array.isArray(options)||options.length<1||options.length>8)
  throw Error('invalid_hypothesis_options');
 const seen=new Set();
 const evaluated=options.map(o=>{
  const x=option(o),key=x.motor.f1+':'+x.motor.f2;
  if(seen.has(key))throw Error('duplicate_hypothesis_motor');
  seen.add(key);
  // High uncertainty + distance to known examples means informative action.
  const e=x.estimate,score=e.ready?
   Math.min(1,.74*(1-e.confidence)+.24*Math.min(1,e.nearest)+
    .02/Math.sqrt(e.examples+1)):1;
  return {...x,score:+score.toFixed(8)};
 });
 evaluated.sort((a,b)=>b.score-a.score||a.motor.f1-b.motor.f1||
  a.motor.f2-b.motor.f2);
 const best=evaluated[0];
 return {schema:'mikoshi.hypothesis.choice.v1',motor:best.motor,
  predicted:best.estimate.predicted,
  expectedConfidence:best.estimate.confidence,
  informationScore:best.score,
  reason:best.estimate.ready?'uncertain_sensorimotor_outcome':
   'no_prior_observation',alternatives:evaluated.length,
  languageModel:false};
}

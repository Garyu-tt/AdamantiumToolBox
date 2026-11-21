import {randomUUID} from 'node:crypto';
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function validateGenome(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_genome');
 const initial=raw.initial_neurons??8,target=raw.target_neurons??32,maximum=raw.maximum_neurons??256;
 const rate=raw.learning_rate??0.05,activity=raw.homeostatic_target??0.2;
 if(!int(initial,1,256)||!int(target,initial,256)||!int(maximum,target,256))throw Error('invalid_neuron_budget');
 if(!finite(rate,0.00001,1)||!finite(activity,0,1))throw Error('invalid_regulation');
 const species=raw.species??'synthetic';
 if(typeof species!=='string'||!/^[-_a-zA-Z0-9]{1,50}$/.test(species))throw Error('invalid_profile');
 return {schema:'genesis.genome/v1',species,initial_neurons:initial,
  target_neurons:target,maximum_neurons:maximum,learning_rate:rate,homeostatic_target:activity};
}
const note=(b,kind,data={})=>{
 b.revision++;b.history.push({kind,revision:b.revision,tick:b.ticks,...data});
 if(b.history.length>64)b.history.shift();
};
export function createBrain(genome={}){
 const g=validateGenome(genome),neurons=Array.from({length:g.initial_neurons},
  (_,i)=>({id:i+1,phase:'active',activity:0}));
 return {schema:'genesis.brain/v1',id:randomUUID(),genome:g,neurons,
  synapses:neurons.slice(1).map((n,i)=>({from:i+1,to:n.id,weight:0.2})),
  readout:neurons.map((n,i)=>({id:n.id,weight:i===0?0.5:0})),
  chemistry:{modulator:0.5},ticks:0,revision:0,history:[],parent:null,next_id:neurons.length+1};
}
const readout=b=>b.readout.reduce((v,r)=>v+r.weight*(b.neurons.find(n=>n.id===r.id)?.activity||0),0);
export function summary(b,details=false){
 const result={id:b.id,schema:b.schema,species:b.genome.species,genome:b.genome,
  neurons:b.neurons.length,active:b.neurons.filter(n=>n.phase==='active').length,
  shadow:b.neurons.filter(n=>n.phase==='shadow').length,synapses:b.synapses.length,
  ticks:b.ticks,revision:b.revision,chemistry:b.chemistry,
  output:readout(b),parent:b.parent,history:b.history};
 return details?{...result,cells:b.neurons,connections:b.synapses,readout:b.readout}:result;
}
export function step(b,params={}){
 const input=params.stimulus??0,steps=params.steps??1;
 if(!finite(input,-1,1)||!int(steps,1,200))throw Error('invalid_stimulus');
 for(let t=0;t<steps;t++){
  const active=b.neurons.filter(n=>n.phase==='active'),old=new Map(active.map(n=>[n.id,n.activity]));
  for(const [i,n] of active.entries()){
   const weighted=b.synapses.filter(s=>s.to===n.id).reduce((v,s)=>v+(old.get(s.from)||0)*s.weight,0);
   n.activity=Math.tanh((i===0?input:0)+weighted+(b.chemistry.modulator-0.5)*0.1);
  }
  const average=active.reduce((v,n)=>v+Math.abs(n.activity),0)/active.length;
  b.chemistry.modulator=clamp(b.chemistry.modulator+
   0.01*(b.genome.homeostatic_target-average),0,1);
  b.ticks++;
 }
 return {output:readout(b),ticks:b.ticks,modulator:b.chemistry.modulator};
}
export function train(b,params={}){
 const target=params.target;
 if(!finite(target,-1,1))throw Error('invalid_target');
 const error=target-readout(b),active=b.neurons.filter(n=>n.phase==='active');
 const norm=0.01+active.reduce((v,n)=>v+n.activity*n.activity,0);
 for(const r of b.readout){
  const n=active.find(n=>n.id===r.id);
  if(n)r.weight=clamp(r.weight+b.genome.learning_rate*error*n.activity/norm,-5,5);
 }
 note(b,'training');return {error,output:readout(b)};
}
export function grow(b,params={}){
 const count=params.count??1;
 if(!int(count,1,64)||b.neurons.length+count>b.genome.target_neurons)throw Error('growth_limit');
 const source=b.neurons.findLast(n=>n.phase==='active')?.id;
 for(let i=0;i<count;i++){
  const id=b.next_id++;b.neurons.push({id,phase:'shadow',activity:0});
  b.readout.push({id,weight:0});
  if(source)b.synapses.push({from:source,to:id,weight:0.1});
 }
 note(b,'shadow_growth',{count});return summary(b);
}
export function integrate(b,params={}){
 const count=params.count??1;
 if(!int(count,1,64))throw Error('invalid_count');
 const shadow=b.neurons.filter(n=>n.phase==='shadow').slice(0,count);
 if(shadow.length!==count)throw Error('shadow_count_exceeded');
 for(const n of shadow)n.phase='active';
 note(b,'integrated',{count});return summary(b);
}
export function retarget(b,params={}){
 const target=params.target_neurons;
 if(!int(target,b.neurons.length,b.genome.maximum_neurons))throw Error('invalid_target_capacity');
 b.genome.target_neurons=target;note(b,'retarget',{target});return summary(b);
}

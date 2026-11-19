// Small trainable CPU MLP for prosody correction. Not a language or cognition model.
const D=5,H=6,scale=[8,20];
const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
export function initialize(){
 return {schema:'mikoshi.prosody.mlp.v1',steps:0,positive:0,
  w1:Array.from({length:H},(_,i)=>Array.from({length:D},(_,j)=>
   Math.sin(1+i*D+j)*.09)),b1:Array(H).fill(0),
  w2:Array.from({length:2},(_,i)=>Array.from({length:H},(_,j)=>
   Math.cos(1+i*H+j)*.09)),b2:[0,0]};
}
function checked(s){
 const matrix=(m,rows,cols)=>Array.isArray(m)&&m.length===rows&&
  m.every(row=>Array.isArray(row)&&row.length===cols&&
   row.every(v=>Number.isFinite(v)&&Math.abs(v)<30));
 if(!s||s.schema!=='mikoshi.prosody.mlp.v1'||
  !Number.isSafeInteger(s.steps)||s.steps<0||
  !Number.isSafeInteger(s.positive)||s.positive<0||
  !matrix(s.w1,H,D)||!matrix(s.w2,2,H)||
  !Array.isArray(s.b1)||s.b1.length!==H||
  !Array.isArray(s.b2)||s.b2.length!==2||
  ![...s.b1,...s.b2].every(v=>Number.isFinite(v)&&Math.abs(v)<30))
  throw Error('invalid_prosody_state');
}
export function features(text){
 if(typeof text!=='string'||text.length<1||text.length>160||
  /[\x00-\x08]/.test(text))throw Error('invalid_utterance');
 const words=text.trim().split(/\s+/).length;
 const capitals=[...text].filter(x=>x.toUpperCase()===x&&x.toLowerCase()!==x).length;
 return [Math.min(1,text.length/100),Math.min(1,words/25),
  text.includes('?')?1:0,text.includes('!')?1:0,
  Math.min(1,capitals/Math.max(1,text.length)*5)];
}
function forward(s,text){
 checked(s);const x=features(text);
 const h=s.w1.map((w,i)=>Math.tanh(w.reduce((sum,v,j)=>sum+v*x[j],s.b1[i])));
 const y=s.w2.map((w,i)=>Math.tanh(w.reduce((sum,v,j)=>sum+v*h[j],s.b2[i])));
 return {x,h,y};
}
export function suggest(s,text){
 const {y}=forward(s,text);
 return {schema:'mikoshi.prosody.suggestion.v1',
  pitchDelta:Math.round(y[0]*scale[0]),speedDelta:Math.round(y[1]*scale[1]),
  observations:s.steps,provider:'online-mlp'};
}
export function feedback(s,text,direction){
 if(!['higher','lower','faster','slower','good'].includes(direction))
  throw Error('invalid_feedback');
 const next=structuredClone(s),a=forward(next,text);
 if(direction==='good'){next.positive++;return {state:next,updated:false};}
 const target=a.y.map((y,i)=>y*scale[i]);
 if(direction==='higher')target[0]=limit(target[0]+2,-8,8);
 if(direction==='lower')target[0]=limit(target[0]-2,-8,8);
 if(direction==='faster')target[1]=limit(target[1]+5,-20,20);
 if(direction==='slower')target[1]=limit(target[1]-5,-20,20);
 const normalized=target.map((v,i)=>v/scale[i]),lr=.12;
 for(let epoch=0;epoch<8;epoch++){
  const {x,h,y}=forward(next,text);
  const d2=y.map((v,j)=>(v-normalized[j])*(1-v*v));
  const d1=h.map((v,i)=>(d2[0]*next.w2[0][i]+d2[1]*next.w2[1][i])*(1-v*v));
  for(let j=0;j<2;j++){
   for(let i=0;i<H;i++)next.w2[j][i]-=lr*d2[j]*h[i];
   next.b2[j]-=lr*d2[j];
  }
  for(let i=0;i<H;i++){
   for(let j=0;j<D;j++)next.w1[i][j]-=lr*d1[i]*x[j];
   next.b1[i]-=lr*d1[i];
  }
 }
 next.steps++;
 return {state:next,updated:true};
}

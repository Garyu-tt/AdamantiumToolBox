/** Fractional split lines are independent of screen resolution and persisted per preset. */
export function axes(preset){
 if(preset==='focus')return {xs:[.6],ys:[.5]};
 const grid={2:[2,1],4:[2,2],8:[4,2]}[preset];
 if(!grid)throw Error('invalid_layout');
 const divisions=n=>Array.from({length:n-1},(_,i)=>(i+1)/n);
 return {xs:divisions(grid[0]),ys:divisions(grid[1])};
}
export function ratios(preset,stored){
 const standard=axes(preset),result={};
 for(const axis of ['xs','ys']){
  const values=stored?.[axis],defaults=standard[axis];
  const min=1/(defaults.length+1)*.35;
  result[axis]=Array.isArray(values)&&values.length===defaults.length&&
   values.every((v,i)=>Number.isFinite(v)&&v>=min&&v<=1-min&&
    (!i||v-values[i-1]>=min))?[...values]:[...defaults];
 }
 return result;
}
export function changeRatio(preset,state,axis,index,value){
 if(!['xs','ys'].includes(axis))return false;
 const current=ratios(preset,state),a=current[axis];
 if(!Number.isInteger(index)||index<0||index>=a.length||!Number.isFinite(value))return false;
 const min=1/(a.length+1)*.35;
 const previous=index===0?0:a[index-1],next=index===a.length-1?1:a[index+1];
 a[index]=Math.max(previous+min,Math.min(next-min,value));
 Object.assign(state,current);return true;
}
export function guides(preset,width,height,state){
 const r=ratios(preset,state);
 const horizontal=r.ys.map((fraction,index)=>({
  axis:'ys',index,x:preset==='focus'?Math.round(r.xs[0]*width):0,
  y:Math.round(fraction*height),length:preset==='focus'?Math.round((1-r.xs[0])*width):width
 }));
 const vertical=r.xs.map((fraction,index)=>({
  axis:'xs',index,x:Math.round(fraction*width),y:0,length:height
 }));
 return [...vertical,...horizontal];
}

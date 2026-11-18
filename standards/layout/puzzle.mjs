import {normalize,bounds,fits,holes,density,between} from './geometry.mjs';
const pos=(p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?p:null;
function choices(item,columns){
 const shapes=[];
 for(let w=item.minW;w<=item.maxW;w++)for(let h=item.minH;h<=item.maxH;h++)
  shapes.push({w,h,shapeCost:Math.abs(w-item.prefW)*3+Math.abs(h-item.prefH)*2});
 return shapes.sort((a,b)=>a.shapeCost-b.shapeCost||b.w*b.h-a.w*a.h);
}
function distance(candidate,other){
 const dx=Math.max(0,other.x-candidate.x-candidate.w,candidate.x-other.x-other.w);
 const dy=Math.max(0,other.y-candidate.y-candidate.h,candidate.y-other.y-other.h);
 return dx+dy;
}
function best(item,placed,columns,preferred,limit){
 let pick=null,score=Infinity;
 const relations=Array.isArray(item.near)?item.near:[];
 const known=placed.filter(p=>relations.includes(p.id));
 for(const shape of choices(item,columns)){
  for(let y=0;y<limit;y++)for(let x=0;x<=columns-shape.w;x++){
   const box={id:item.id,x,y,w:shape.w,h:shape.h};
   if(!fits(box,placed,columns))continue;
   const height=Math.max(y+shape.h,...placed.map(p=>p.y+p.h),0);
   const totalArea=placed.reduce((n,p)=>n+p.w*p.h,shape.w*shape.h);
   const voids=columns*height-totalArea;
   const location=preferred?Math.abs(x-preferred.x)+Math.abs(y-preferred.y):0;
   const neighbors=known.reduce((n,p)=>n+distance(box,p),0);
   const cost=height*12+voids*.8+shape.shapeCost*8+location*3+neighbors*4+y*.1+x*.01;
   if(cost<score){score=cost;pick=box;}
  }
  if(pick&&shape.shapeCost===0)break;
 }
 return pick;
}
export function layout(widgets,width,opts={}){
 const columns=bounds(width,opts),placed=[],limit=between(Number(opts.maxRows)||72,4,400);
 const positions=opts.positions||{},anchor=opts.anchor||null;
 const items=widgets.filter(w=>typeof w.id==='string')
  .map(w=>normalize(w,columns)).sort((a,b)=>{
   if(a.id===anchor?.id)return -1;if(b.id===anchor?.id)return 1;
   return b.priority-a.priority||String(a.id).localeCompare(String(b.id));
  });
 const rejected=[];
 for(const item of items){
  const old=pos(positions[item.id]),target=item.id===anchor?.id?pos(anchor):old;
  let box;
  if(item.id===anchor?.id&&target){
   const candidate={id:item.id,x:between(Math.round(target.x),0,columns-item.prefW),
    y:between(Math.round(target.y),0,limit-1),w:item.prefW,h:item.prefH};
   if(fits(candidate,placed,columns))box=candidate;
  }
  box=box||best(item,placed,columns,target,limit);
  if(!box){rejected.push(item.id);continue;}
  placed.push({...box,density:density(box,item.density),priority:item.priority});
 }
 return {columns,items:placed,holes:holes(placed,columns),rejected};
}

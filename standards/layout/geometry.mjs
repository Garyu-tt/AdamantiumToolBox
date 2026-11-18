export const between=(v,min,max)=>Math.max(min,Math.min(max,v));
export function normalize(widget,columns){
 const size=widget.size||{},max=columns;
 const minW=between(Number(size.minW)||1,1,max),minH=between(Number(size.minH)||1,1,20);
 const maxW=between(Number(size.maxW)||max,minW,max),maxH=between(Number(size.maxH)||8,minH,20);
 const prefW=between(Number(size.prefW)||minW,minW,maxW);
 const prefH=between(Number(size.prefH)||minH,minH,maxH);
 return {...widget,minW,minH,maxW,maxH,prefW,prefH,priority:between(Number(widget.priority)||0,0,100)};
}
export function density(item,breakpoints={compact:2,expanded:8}){
 const area=item.w*item.h;
 return area<=breakpoints.compact?'compact':area>=breakpoints.expanded?'expanded':'normal';
}
export function intersects(a,b){
 return !(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
}
export function fits(box,placed,columns){
 return box.x>=0&&box.y>=0&&box.x+box.w<=columns&&!placed.some(x=>intersects(box,x));
}
export function bounds(width,{cellMin=144,gap=6,maxColumns=12}={}){
 return between(Math.floor((Math.max(1,width)+gap)/(cellMin+gap)),1,maxColumns);
}
export function holes(placed,columns){
 if(!placed.length)return 0;
 const rows=Math.max(...placed.map(v=>v.y+v.h)),count=placed.reduce((n,v)=>n+v.w*v.h,0);
 return columns*rows-count;
}

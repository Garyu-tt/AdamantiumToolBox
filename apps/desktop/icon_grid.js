/** Dynamic grid resolution: persisted pixel coordinates, deterministic fallback. */
export const cell=100;
export function snapped(point,width,height){
 const rows=Math.max(1,Math.floor(Math.max(0,height-16)/cell));
 const cols=Math.max(1,Math.floor(Math.max(0,width-16)/cell));
 const x=Math.max(0,Math.min(cols-1,Math.round((point.x-12)/cell)));
 const y=Math.max(0,Math.min(rows-1,Math.round((point.y-12)/cell)));
 return {x:12+x*cell,y:12+y*cell};
}
export function positionsFor(items,saved,width,height){
 const used=new Set(),placed={};
 const rows=Math.max(1,Math.floor(Math.max(0,height-16)/cell));
 const cols=Math.max(1,Math.floor(Math.max(0,width-16)/cell));
 const key=p=>p.x+':'+p.y;
 const firstFree=()=>{
  for(let x=0;x<cols;x++)for(let y=0;y<rows;y++){
   const p={x:12+x*cell,y:12+y*cell};
   if(!used.has(key(p)))return p;
  }
  return {x:12+Math.floor(used.size/rows)*cell,y:12+(used.size%rows)*cell};
 };
 for(const item of items){
  const stored=saved?.[item.id];
  let p=stored?snapped(stored,width,height):null;
  if(!p||used.has(key(p)))p=firstFree();
  used.add(key(p));placed[item.id]=p;
 }
 return placed;
}
export function swapInto(state,id,target,placed,width,height){
 if(!placed[id])return false;
 const next=snapped(target,width,height),old=placed[id];
 const occupied=Object.keys(placed).find(key=>key!==id&&placed[key].x===next.x&&placed[key].y===next.y);
 if(occupied)state.positions[occupied]={...old};
 state.positions[id]=next;return true;
}

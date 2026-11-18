/** Pure window geometry: all coordinates are relative to the workspace. */
const dimensions={2:[2,1],4:[2,2],8:[4,2]};
export function layoutRects(width,height,preset,count=preset==='focus'?3:preset){
 if(preset==='focus'){
  const n=Math.max(0,Math.min(count,3)),split=Math.round(width*.6);
  const middle=Math.round(height/2);
  return [
   {x:0,y:0,width:split,height},
   {x:split,y:0,width:width-split,height:middle},
   {x:split,y:middle,width:width-split,height:height-middle}
  ].slice(0,n);
 }
 const shape=dimensions[preset];
 if(!shape)throw Error('invalid_layout');
 const [cols,rows]=shape,n=Math.max(0,Math.min(count,preset));
 return Array.from({length:n},(_,i)=>{
  const col=i%cols,row=Math.floor(i/cols);
  const x=Math.round(width*col/cols),y=Math.round(height*row/rows);
  return {x,y,width:Math.round(width*(col+1)/cols)-x,
   height:Math.round(height*(row+1)/rows)-y};
 });
}
export function snapRect(width,height,zone){
 if(zone==='max')return {x:0,y:0,width,height};
 const halfX=Math.round(width/2),halfY=Math.round(height/2);
 const x=zone.includes('right')?halfX:0,y=zone.includes('bottom')?halfY:0;
 const w=zone.includes('right')?width-halfX:halfX;
 const h=zone.includes('top-')||zone.includes('bottom-')
  ?(zone.includes('bottom')?height-halfY:halfY):height;
 if(!['left','right','top-left','top-right','bottom-left','bottom-right'].includes(zone))
  throw Error('invalid_snap');
 return {x,y,width:w,height:h};
}
export function edgeZone(x,y,width,height,threshold=22){
 const left=x<=threshold,right=x>=width-threshold;
 const top=y<=threshold,bottom=y>=height-threshold;
 if(left&&top)return 'top-left';
 if(right&&top)return 'top-right';
 if(left&&bottom)return 'bottom-left';
 if(right&&bottom)return 'bottom-right';
 if(top)return 'max';
 if(left)return 'left';
 if(right)return 'right';
 return null;
}
export function fitFloating(rect,width,height){
 const w=Math.max(1,Math.min(rect.width,width)),h=Math.max(1,Math.min(rect.height,height));
 return {x:Math.max(0,Math.min(rect.x,width-w)),
  y:Math.max(0,Math.min(rect.y,height-h)),width:w,height:h};
}

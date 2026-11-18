const bounded=(n,min,max)=>Math.min(max,Math.max(min,n));
export function dragPosition(start,pointer,area){
 const w=Math.min(area.width,start.width),h=Math.min(area.height,start.height);
 return {left:bounded(start.left+pointer.x-start.x,0,Math.max(0,area.width-w)),
  top:bounded(start.top+pointer.y-start.y,0,Math.max(0,area.height-h)),
  width:w,height:h};
}
export function snapTarget(pointer,area,threshold){
 const x=pointer.x-area.left,y=pointer.y-area.top;
 if(x<0||y<0||x>area.width||y>area.height)return null;
 const left=x<=threshold,right=x>=area.width-threshold;
 const top=y<=threshold,bottom=y>=area.height-threshold;
 if(top&&left)return 'top-left';
 if(top&&right)return 'top-right';
 if(bottom&&left)return 'bottom-left';
 if(bottom&&right)return 'bottom-right';
 if(top)return 'maximize';
 if(left)return 'left';
 if(right)return 'right';
 return null;
}
export function snapBounds(target,width,height,ratio=0.5){
 const a=bounded(ratio,0.2,0.8),x=Math.round(width*a),y=Math.round(height/2);
 const rects={
  maximize:[0,0,width,height],left:[0,0,x,height],
  right:[x,0,width-x,height],
  'top-left':[0,0,x,y],'top-right':[x,0,width-x,y],
  'bottom-left':[0,y,x,height-y],'bottom-right':[x,y,width-x,height-y]
 };
 const r=rects[target];if(!r)throw Error('unknown_snap_target');
 return {left:r[0],top:r[1],width:r[2],height:r[3]};
}
function frame(x,y,width,height,gap){
 const margin=gap/2;
 return {left:Math.round(x+margin),top:Math.round(y+margin),
  width:Math.max(1,Math.round(width-gap)),
  height:Math.max(1,Math.round(height-gap))};
}
function grid(count,x,y,width,height,columns,gap){
 const rows=Math.ceil(count/columns),out=[];
 for(let i=0;i<count;i++){
  const row=Math.floor(i/columns),position=i%columns;
  const rowCount=Math.min(columns,count-row*columns);
  out.push(frame(x+width*position/rowCount,y+height*row/rows,
   width/rowCount,height/rows,gap));
 }
 return out;
}
export function tileBounds(count,layout,area,ratio=0.62,config={}){
 if(!Number.isInteger(count)||count<0||count>64)throw Error('bad_window_count');
 if(!count)return [];
 const {width,height}=area,gap=config.gapPx??6;
 const columns=config.gridColumnsByCount?.[count-1]||
  Math.max(1,Math.round(Math.sqrt(count*width/Math.max(height,1))));
 if(layout==='grid')return grid(count,0,0,width,height,columns,gap);
 if(layout==='columns')return grid(count,0,0,width,height,count,gap);
 if(layout==='rows')return Array.from({length:count},(_,i)=>
  frame(0,height*i/count,width,height/count,gap));
 if(!['main-left','main-right','main-top'].includes(layout))throw Error('bad_layout');
 if(count===1)return [frame(0,0,width,height,gap)];
 const a=bounded(ratio,0.25,0.75),rest=count-1;
 if(layout==='main-top'){
  const h=Math.round(height*a);
  return [frame(0,0,width,h,gap),
   ...grid(rest,0,h,width,height-h,Math.ceil(Math.sqrt(rest)),gap)];
 }
 const big=Math.round(width*a),small=width-big;
 const mainX=layout==='main-left'?0:small,otherX=layout==='main-left'?big:0;
 const otherColumns=rest>=5?2:1;
 return [frame(mainX,0,big,height,gap),
  ...grid(rest,otherX,0,small,height,otherColumns,gap)];
}
export function restoreBounds(saved,area){
 const width=Math.min(saved.width,area.width),height=Math.min(saved.height,area.height);
 return {left:bounded(saved.left,0,Math.max(0,area.width-width)),
  top:bounded(saved.top,0,Math.max(0,area.height-height)),width,height};
}

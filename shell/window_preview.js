import {snapBounds} from './window_geometry.js';
export function createSnapPreview(desktop,size,ratio){
 const node=document.createElement('div');
 node.className='window-snap-preview';node.hidden=true;desktop.append(node);
 return target=>{
  if(!target){node.hidden=true;return;}
  const {width,height}=size(),box=snapBounds(target,width,height,ratio());
  for(const key of ['left','top','width','height'])
   node.style[key]=Math.round(box[key])+'px';
  node.hidden=false;
 };
}

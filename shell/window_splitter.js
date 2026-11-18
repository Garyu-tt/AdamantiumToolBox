/** Pixel-level drag handles over a tiling group; no dependency on app modules. */
export function createSplitters(desktop,move,commit){
 const layer=document.createElement('div');layer.className='win-split-layer';
 desktop.append(layer);const handles=new Map();
 function draw(items){
  const active=new Set();
  for(const guide of items){
   const key=guide.axis+':'+guide.index;active.add(key);
   let bar=handles.get(key);
   if(!bar){
    bar=document.createElement('div');bar.className='win-split';
    bar.dataset.axis=guide.axis;bar.dataset.index=String(guide.index);
    bar.style.touchAction='none';
    bar.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     bar.setPointerCapture(e.pointerId);e.preventDefault();
    });
    bar.addEventListener('pointermove',e=>{
     if(!bar.hasPointerCapture(e.pointerId))return;
     const bounds=desktop.getBoundingClientRect();
     move(guide.axis,guide.index,guide.axis==='xs'?
      (e.clientX-bounds.left)/bounds.width:(e.clientY-bounds.top)/bounds.height);
    });
    const done=e=>{
     if(!bar.hasPointerCapture(e.pointerId))return;
     bar.releasePointerCapture(e.pointerId);commit();
    };
    bar.addEventListener('pointerup',done);bar.addEventListener('pointercancel',done);
    layer.append(bar);handles.set(key,bar);
   }
   bar.style.left=guide.x+'px';bar.style.top=guide.y+'px';
   bar.style.width=(guide.axis==='xs'?8:guide.length)+'px';
   bar.style.height=(guide.axis==='ys'?8:guide.length)+'px';
  }
  for(const [key,bar] of handles)if(!active.has(key)){bar.remove();handles.delete(key);}
 }
 function clear(){draw([]);}
 return {draw,clear,dispose:()=>layer.remove()};
}

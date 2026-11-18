/** Context menus are DOM-owned and can be removed with the desktop plugin. */
export function createMenu(){
 const container=document.createElement('div');container.className='ada-context';
 document.body.append(container);
 function close(){container.classList.remove('open');container.replaceChildren();}
 function show(event,options){
  event.preventDefault();container.replaceChildren();
  for(const {title,run} of options){
   const button=document.createElement('button');button.type='button';button.textContent=title;
   button.onclick=()=>{close();run();};container.append(button);
  }
  container.style.left=Math.max(0,Math.min(event.clientX,innerWidth-245))+'px';
  container.style.top=Math.max(0,Math.min(event.clientY,innerHeight-60-options.length*35))+'px';
  container.classList.add('open');
 }
 const outside=e=>{if(!container.contains(e.target))close();};
 const key=e=>{if(e.key==='Escape')close();};
 document.addEventListener('pointerdown',outside);
 document.addEventListener('keydown',key);
 return {show,close,dispose(){
  document.removeEventListener('pointerdown',outside);
  document.removeEventListener('keydown',key);container.remove();
 }};
}

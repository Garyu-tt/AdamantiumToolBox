/** A self-contained LinkFS folder window, independent of application services. */
export function folderWindow(desktop,folder,openApp,iconFor,views){
 const node=(tag,cls,text)=>{const x=document.createElement(tag);x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const win=node('section','window ada-explorer'),bar=node('div','titlebar');
 const title=node('strong','',folder.name),back=node('button','','←'),max=node('button','','□'),close=node('button','','×');
 const toolbar=node('div','ada-explorer-toolbar'),body=node('div','ada-explorer-body');
 let stack=[folder],saved=null;
 const focus=()=>{win.style.zIndex=String(200+document.querySelectorAll('.window').length);};
 function maximize(){
  if(saved){Object.assign(win.style,saved);saved=null;max.textContent='□';return;}
  saved={left:win.style.left,top:win.style.top,width:win.style.width,height:win.style.height};
  Object.assign(win.style,{left:'0',top:'0',width:'100%',height:'100%'});
  max.textContent='❐';
 }
 function draw(){
  const here=stack.at(-1);title.textContent=here.name;back.disabled=stack.length===1;
  body.replaceChildren();
  for(const item of here.children||[]){
   const b=node('button','ada-file');b.type='button';
   const image=item.type==='folder'?node('span','ada-folder-icon','📁'):iconFor(views.get(item.view)||{});
   b.append(image,node('span','',item.name));
   b.onclick=()=>item.type==='folder'?(stack.push(item),draw()):openApp(views.get(item.view));
   body.append(b);
  }
  if(!body.children.length)body.append(node('p','ada-empty','Папка пуста'));
 }
 back.onclick=()=>{if(stack.length>1)stack.pop();draw();};
 max.onclick=maximize;close.onclick=()=>win.remove();
 bar.ondblclick=e=>{if(!e.target.closest('button'))maximize();};
 toolbar.append(back);bar.append(title,max,close);win.append(bar,toolbar,body);
 win.style.left='9%';win.style.top='8%';win.style.width='min(700px,88%)';win.style.height='min(500px,80%)';
 desktop.append(win);focus();draw();
 bar.addEventListener('pointerdown',e=>{
  if(e.target.closest('button'))return;
  if(saved)maximize();
  const bounds=desktop.getBoundingClientRect(),rect=win.getBoundingClientRect();
  const dx=e.clientX-rect.left,dy=e.clientY-rect.top;
  bar.setPointerCapture(e.pointerId);focus();
  const move=p=>{
   win.style.left=Math.max(0,p.clientX-bounds.left-dx)+'px';
   win.style.top=Math.max(0,p.clientY-bounds.top-dy)+'px';
  };
  const stop=p=>{
   bar.removeEventListener('pointermove',move);
   bar.removeEventListener('pointerup',stop);
   bar.removeEventListener('pointercancel',stop);
   if(p.type==='pointercancel')return;
   if(p.clientY-bounds.top<18)maximize();
   else if(p.clientX-bounds.left<18){win.style.left='0';win.style.top='0';win.style.width='50%';win.style.height='100%';}
   else if(bounds.right-p.clientX<18){win.style.left='50%';win.style.top='0';win.style.width='50%';win.style.height='100%';}
  };
  bar.addEventListener('pointermove',move);
  bar.addEventListener('pointerup',stop);
  bar.addEventListener('pointercancel',stop);
 });
 return win;
}

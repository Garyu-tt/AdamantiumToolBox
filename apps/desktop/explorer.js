/** LinkFS folder explorer uses the same window manager as every other tool. */
export function folderWindow(desktop,folder,openApp,iconFor,views,manager,resolveFolder=()=>null){
 const node=(tag,cls,text)=>{
  const x=document.createElement(tag);x.className=cls;
  if(text!==undefined)x.textContent=text;
  return x;
 };
 const win=node('section','window ada-explorer'),bar=node('div','titlebar');
 const title=node('strong','',folder.name),back=node('button','','←');
 const toolbar=node('div','ada-explorer-toolbar'),body=node('div','ada-explorer-body');
 let stack=[folder];
 function draw(){
  const here=resolveFolder(stack.at(-1).id)||stack.at(-1);title.textContent=here.name;
  back.disabled=stack.length===1;body.replaceChildren();
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
 bar.append(title);toolbar.append(back);
 win.append(bar,toolbar,body);
 win.style.left='9%';win.style.top='8%';
 win.style.width='min(700px,88%)';win.style.height='min(500px,80%)';
 desktop.append(win);
 const handle=manager.register(win,bar,{key:'folder:'+crypto.randomUUID(),title:folder.name});
 draw();return {...handle,refresh:draw};
}

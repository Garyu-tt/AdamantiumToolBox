/** Optional desktop layout selector; geometry stays in the shared shell. */
export function mountLayouts(taskbar,windows){
 const container=document.createElement('div');container.className='ada-layout-control';
 const toggle=document.createElement('button');toggle.type='button';
 toggle.className='ada-layout-button';toggle.textContent='▦ Окна';
 toggle.setAttribute('aria-label','Раскладка окон');toggle.setAttribute('aria-expanded','false');
 const menu=document.createElement('div');menu.className='ada-layout-menu';
 const presets=[
  [2,'2 окна рядом','Ctrl+Alt+2'],
  [4,'4 окна, сетка 2×2','Ctrl+Alt+4'],
  [8,'8 окон, сетка 4×2','Ctrl+Alt+8'],
  ['focus','Главное + два','Ctrl+Alt+3']
 ];
 function show(open){
  menu.classList.toggle('open',open);
  toggle.setAttribute('aria-expanded',String(open));
 }
 for(const [preset,title,hotkey] of presets){
  const b=document.createElement('button');b.type='button';
  const glyph=document.createElement('span');glyph.className='ada-layout-glyph';
  glyph.dataset.preset=String(preset);
  for(let n=0;n<(preset==='focus'?3:preset);n++)glyph.append(document.createElement('i'));
  const name=document.createElement('span');name.textContent=title;
  const key=document.createElement('small');key.textContent=hotkey;
  b.append(glyph,name,key);b.onclick=()=>{windows.arrange(preset);show(false);};
  menu.append(b);
 }
 const dismiss=event=>{
  if(!container.contains(event.target))show(false);
 };
 const escape=event=>{if(event.key==='Escape')show(false);};
 toggle.onclick=()=>show(!menu.classList.contains('open'));
 container.append(toggle,menu);
 taskbar.insertBefore(container,taskbar.querySelector('#tasks'));
 document.addEventListener('pointerdown',dismiss);
 document.addEventListener('keydown',escape);
 return {dispose(){
  document.removeEventListener('pointerdown',dismiss);
  document.removeEventListener('keydown',escape);
  container.remove();
 }};
}

/** Adapt the existing window manager to an optional workspace plugin. */
export function workspaceWindows(manager,onChange=()=>{}){
 const config=manager.settings().config;
 const choices=config.layouts.filter(x=>typeof x.id==='string');
 function arrange(id){
  const selected=choices.find(x=>x.id===id)||
   (typeof id==='number'?choices.find(x=>x.mode==='grid'):null)||
   (id==='focus'?choices.find(x=>x.mode==='main-left'):null);
  if(!selected)return 0;
  return manager.tile(selected.id);
 }
 function register(win,bar,{key,title,onClose}){
  const close=document.createElement('button');
  close.textContent='×';close.setAttribute('aria-label','Закрыть');
  const cleanup=()=>{
   manager.remove(win);win.remove();onClose?.();onChange();
  };
  close.onclick=cleanup;bar.append(close);
  manager.add(win,bar,{id:key,title});onChange();
  return {element:win,close:cleanup,
   focus:()=>manager.show(win),minimize:()=>manager.minimize(win),
   restore:()=>manager.restore(win),maximize:()=>manager.toggleMax(win)};
 }
 return {register,arrange,layouts:choices.map(x=>({id:x.id,label:x.label}))};
}

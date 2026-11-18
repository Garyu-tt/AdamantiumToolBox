/** Optional workspace provider selection. No application ID is compiled into the shell. */
let active=null;
export async function bindWorkspace(views,tree,context){
 const candidates=views.filter(v=>v.surface==='workspace'&&typeof v.entry==='string')
  .sort((a,b)=>a.id.localeCompare(b.id));
 const provider=candidates[0];
 if(!provider){
  active?.instance?.dispose?.();active=null;document.body.classList.remove('workspace-mode');
  return false;
 }
 if(!active||active.entry!==provider.entry){
  active?.instance?.dispose?.();active=null;
  try{
   const module=await import(provider.entry);
   if(typeof module.mount!=='function')throw Error('workspace_mount_missing');
   const instance=await module.mount(context.desktop,{shell:{...context,tree,views}});
   if(!instance||typeof instance.update!=='function'||typeof instance.dispose!=='function')
    throw Error('workspace_lifecycle_missing');
   active={entry:provider.entry,instance};
  }catch(e){
   console.warn('Workspace plugin unavailable:',e);
   document.body.classList.remove('workspace-mode');
   return false;
  }
 }else active.instance.update(tree,views);
 document.body.classList.add('workspace-mode');
 return true;
}

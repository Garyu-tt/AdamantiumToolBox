import {workspaceWindows} from '/shell/workspace_adapter.js';
/** An installed MAS view may optionally provide the desktop surface. */
let current=null;
export function selectWorkspace(views){
 return views.filter(v=>v.type==='view'&&v.surface==='workspace'&&
  typeof v.entry==='string').sort((a,b)=>a.id.localeCompare(b.id))[0]||null;
}
export async function bindWorkspace(views,tree,context){
 const provider=selectWorkspace(views);
 if(!provider){
  current?.instance.dispose();current=null;
  document.body.classList.remove('workspace-mode');return false;
 }
 if(current?.entry===provider.entry){
  current.instance.update(tree,views);return true;
 }
 current?.instance.dispose();current=null;
 document.body.classList.remove('workspace-mode');
 try{
  const module=await import(provider.entry);
  if(typeof module.mount!=='function')throw Error('workspace_mount_missing');
  const windows=workspaceWindows(context.manager,context.paintTasks);
  const api={shell:{...context,views,tree,windows}};
  const instance=await module.mount(context.desktop,api);
  if(!instance||typeof instance.update!=='function'||typeof instance.dispose!=='function')
   throw Error('workspace_lifecycle_missing');
  current={entry:provider.entry,instance};
  document.body.classList.add('workspace-mode');return true;
 }catch(error){
  console.warn('Workspace plugin is unavailable:',error);
  document.body.classList.remove('workspace-mode');return false;
 }
}

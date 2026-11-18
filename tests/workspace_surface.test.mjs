import {strict as assert} from 'node:assert';
import {workspaceWindows} from '../shell/workspace_adapter.js';
import {selectWorkspace,bindWorkspace} from '../shell/workspace_surface.js';
const notes=[],styles=new Set();
const dom=()=>({
 children:[],style:{},append(...nodes){this.children.push(...nodes);},
 remove(){notes.push('removed');},setAttribute(name,value){this[name]=value;}
});
globalThis.document={
 createElement:dom,
 body:{classList:{
  add:k=>styles.add(k),remove:k=>styles.delete(k),contains:k=>styles.has(k)
 }}
};
const manager={
 settings:()=>({config:{layouts:[
  {id:'grid',label:'Сетка',mode:'grid'},{id:'main-left',label:'Главное слева',mode:'main-left'}]}}),
 add:(...args)=>notes.push('added'),remove:()=>notes.push('unregistered'),
 tile:id=>(notes.push('tile:'+id),2),
 show:()=>notes.push('show'),minimize:()=>notes.push('min'),
 restore:()=>notes.push('restore'),toggleMax:()=>notes.push('maximize')
};
const bridge=workspaceWindows(manager,()=>notes.push('paint'));
assert.equal(bridge.layouts.length,2);
const win=dom(),bar=dom();
const handle=bridge.register(win,bar,{key:'folder:sample',title:'Sample'});
assert(notes.includes('added'));assert.equal(bar.children.length,1);
assert.equal(bridge.arrange(2),2);
assert.equal(bridge.arrange('focus'),2);
assert(notes.includes('tile:grid'));assert(notes.includes('tile:main-left'));
handle.focus();handle.minimize();handle.restore();handle.maximize();handle.close();
assert(notes.includes('unregistered'));assert(notes.includes('removed'));
const moduleSource='export async function mount(host,api){if(!api.shell.windows)throw Error("no_manager");'+
 'return {update(){},dispose(){}};}';
const view={id:'temporary.view',type:'view',surface:'workspace',
 entry:'data:text/javascript,'+encodeURIComponent(moduleSource)};
assert.equal(selectWorkspace([{id:'app.view',type:'view',entry:'/app'}]),null);
assert.equal(selectWorkspace([view]).id,view.id);
const context={manager,paintTasks:()=>{},desktop:dom(),taskbar:dom(),
 openApp:()=>{},icon:()=>dom(),system:{},status:dom()};
assert.equal(await bindWorkspace([view],{children:[]},context),true);
assert(styles.has('workspace-mode'));
assert.equal(await bindWorkspace([view],{children:[]},context),true);
assert.equal(await bindWorkspace([],{children:[]},context),false);
assert(!styles.has('workspace-mode'));
console.log('WORKSPACE_SURFACE_OK dynamic plugin fallback and window-manager compatibility');

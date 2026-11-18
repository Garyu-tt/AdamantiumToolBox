import {strict as assert} from 'node:assert';
import {createWindowManager} from '../shell/window_manager.js';
class Element extends EventTarget{
 constructor(tag='div'){
  super();this.tag=tag;this.style={};this.children=[];this.hidden=false;
  this.dataset={};this.attributes={};this.classes=new Set();
  this.classList={
   toggle:(name,on)=>on===undefined?this.classes.has(name)?(this.classes.delete(name),false):(this.classes.add(name),true)
    :on?this.classes.add(name):this.classes.delete(name),
   remove:name=>this.classes.delete(name)
  };
 }
 append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
 replaceChildren(...children){this.children=[];this.append(...children);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setAttribute(name,value){this.attributes[name]=value;}
 get offsetWidth(){return parseFloat(this.style.width)||400;}
 getBoundingClientRect(){
  const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;
  const width=parseFloat(this.style.width)||this.clientWidth||400;
  const height=parseFloat(this.style.height)||this.clientHeight||300;
  return {left,top,right:left+width,bottom:top+height,width,height};
 }
}
const documentEvents=new Map();
globalThis.document={createElement:tag=>new Element(tag),
 addEventListener:(name,handler)=>documentEvents.set(name,handler)};
globalThis.ResizeObserver=class{observe(){}};
const desktop=new Element('desktop');desktop.clientWidth=1200;desktop.clientHeight=800;
const tasks=new Element('tasks'),manager=createWindowManager(desktop,tasks);
function open(id,left=20){
 const win=new Element('window'),bar=new Element('bar');
 Object.assign(win.style,{left:left+'px',top:'30px',width:'400px',height:'300px'});
 win.append(bar);desktop.append(win);
 const handle=manager.register(win,bar,{key:id,title:id});
 return {handle,win,bar};
}
const first=open('first',40),second=open('second',490);
assert.deepEqual(manager.windows(),['first','second']);
assert.equal(tasks.children.length,2);
first.handle.snap('right');
assert.equal(first.win.style.left,'600px');
assert.equal(first.win.style.width,'600px');
first.handle.restore();
assert.equal(first.win.style.left,'40px');
assert.equal(first.win.style.width,'400px');
first.handle.maximize();
assert.equal(first.win.style.width,'1200px');
first.handle.maximize();
assert.equal(first.win.style.left,'40px');
first.handle.minimize();assert.equal(first.win.hidden,true);
first.handle.focus();assert.equal(first.win.hidden,false);
assert.equal(manager.arrange(2),2);
assert.equal(first.win.style.width,'600px');
assert.equal(second.win.style.left,'600px');
const additional=Array.from({length:6},(_,i)=>open('more-'+i,i*25));
first.handle.focus();
assert.equal(manager.arrange(8),8);
assert.equal(first.win.style.width,'300px');
assert.equal(additional.at(-1).win.style.top,'400px');
manager.arrange('focus');
assert.equal(first.win.style.width,'720px');
assert.equal(second.win.style.left,'720px');
desktop.clientWidth=1600;desktop.clientHeight=900;manager.reflow();
assert.equal(first.win.style.width,'960px');
assert.equal(second.win.style.left,'960px');
first.handle.focus();
const press=(key,code,flags)=>{
 let prevented=false;
 documentEvents.get('keydown')({key,code,metaKey:false,ctrlKey:false,altKey:false,
  target:{closest:()=>false},preventDefault:()=>{prevented=true;},...flags});
 assert(prevented,'shortcut_not_handled');
};
press('ArrowLeft','ArrowLeft',{metaKey:true});
assert.equal(first.win.style.width,'800px');
press('2','Digit4',{ctrlKey:true,altKey:true});
assert.equal(first.win.style.width,'800px');
press('3','Digit3',{ctrlKey:true,altKey:true});
assert.equal(first.win.style.width,'960px');
second.handle.focus();
manager.arrange('focus');
assert.equal(second.win.style.width,'960px');
second.handle.close();assert.equal(manager.windows().length,7);
assert.equal(tasks.children.length,7);
assert(!desktop.children.includes(second.win));
console.log('WINDOW_MANAGER_OK lifecycle taskbar restore min/max snap tiled resize');

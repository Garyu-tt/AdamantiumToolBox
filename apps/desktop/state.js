/** Local, versioned layout overlay. Never mutates LinkFS or grants capabilities. */
export const schema='mas-desktop-layout-1';
export const empty=()=>({schema,items:[],positions:{}});
const uid=()=> 'user:'+crypto.randomUUID();
const validId=id=>typeof id==='string'&&/^(user:[0-9a-f-]{36}|base:[^\s]{1,180})$/.test(id);
export function decode(raw){
 let source;try{source=JSON.parse(raw);}catch{return empty();}
 if(!source||source.schema!==schema||!Array.isArray(source.items))return empty();
 const items=[],ids=new Set();
 for(const entry of source.items.slice(0,300)){
  if(!validId(entry?.id)||!entry.id.startsWith('user:')||ids.has(entry.id))continue;
  if(!['folder','app'].includes(entry.kind))continue;
  if(entry.kind==='folder'&&(typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>80))continue;
  if(entry.kind==='app'&&(typeof entry.view!=='string'||entry.view.length>100))continue;
  ids.add(entry.id);items.push({id:entry.id,kind:entry.kind,
   ...(entry.kind==='folder'?{name:entry.name.trim()}:{view:entry.view}),
   parent:typeof entry.parent==='string'?entry.parent:null});
 }
 for(const entry of items){
  if(entry.parent&&!items.some(x=>x.id===entry.parent&&x.kind==='folder'))entry.parent=null;
  const seen=new Set([entry.id]);let parent=entry.parent;
  while(parent){
   if(seen.has(parent)){entry.parent=null;break;}
   seen.add(parent);parent=items.find(x=>x.id===parent)?.parent;
  }
 }
 const positions={};
 if(source.positions&&typeof source.positions==='object'){
  for(const [key,point] of Object.entries(source.positions).slice(0,600)){
   if(!validId(key)||!Number.isInteger(point?.x)||!Number.isInteger(point?.y))continue;
   if(point.x<0||point.y<0||point.x>50000||point.y>50000)continue;
   positions[key]={x:point.x,y:point.y};
  }
 }
 return {schema,items,positions};
}
export function folder(state,name,parent=null){
 const value=String(name||'').trim();
 if(!value||value.length>80||state.items.length>=300)throw Error('invalid_folder');
 if(parent&&!state.items.some(x=>x.id===parent&&x.kind==='folder'))throw Error('invalid_parent');
 const item={id:uid(),kind:'folder',name:value,parent};state.items.push(item);return item;
}
export function pin(state,view,parent=null){
 if(typeof view!=='string'||!view||view.length>100||state.items.length>=300)throw Error('invalid_view');
 if(parent&&!state.items.some(x=>x.id===parent&&x.kind==='folder'))throw Error('invalid_parent');
 const existing=state.items.find(x=>x.kind==='app'&&x.view===view&&x.parent===parent);
 if(existing)return existing;
 const item={id:uid(),kind:'app',view,parent};state.items.push(item);return item;
}
export function move(state,id,parent=null){
 const item=state.items.find(x=>x.id===id);if(!item)return false;
 if(parent&&!state.items.some(x=>x.id===parent&&x.kind==='folder'))return false;
 let node=parent;while(node){
  if(node===id)return false;
  node=state.items.find(x=>x.id===node)?.parent||null;
 }
 item.parent=parent;return true;
}
export function rename(state,id,name){
 const item=state.items.find(x=>x.id===id&&x.kind==='folder');
 const value=String(name||'').trim();
 if(!item||!value||value.length>80)return false;
 item.name=value;return true;
}
export function remove(state,id){
 const before=state.items.length;
 state.items=state.items.filter(x=>x.id!==id);
 for(const item of state.items)if(item.parent===id)item.parent=null;
 delete state.positions[id];return state.items.length!==before;
}
export function setPosition(state,id,x,y){
 if(!validId(id)||!Number.isFinite(x)||!Number.isFinite(y))return;
 state.positions[id]={x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y))};
}
export function customItems(state,parent,views){
 return state.items.filter(x=>x.parent===parent&&(x.kind==='folder'||views.has(x.view)))
  .map(x=>({...x,type:x.kind,name:x.kind==='app'?views.get(x.view).title:x.name}));
}

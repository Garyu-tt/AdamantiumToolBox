/** Owner-private browser preferences; only recognized, bounded window geometry. */
const key='mas.window.placement.v1';
const validId=id=>typeof id==='string'&&/^(app|system):[a-z0-9_.-]{1,100}$/.test(id);
const good=r=>r&&[r.x,r.y,r.width,r.height].every(x=>Number.isFinite(x)&&x>=0&&x<=10000)
 &&r.width>=100&&r.height>=80;
function stored(){
 try{
  const raw=JSON.parse(localStorage.getItem(key)||'{}');
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  return raw;
 }catch{return {};}
}
export function readPlacement(id){
 if(!validId(id))return null;
 const value=stored()[id];return good(value)?{...value}:null;
}
export function savePlacement(id,rect){
 if(!validId(id)||!good(rect))return false;
 const data=stored(),keys=Object.keys(data);
 if(keys.length>200)for(const id of keys.slice(0,keys.length-150))delete data[id];
 data[id]={x:Math.round(rect.x),y:Math.round(rect.y),
  width:Math.round(rect.width),height:Math.round(rect.height)};
 try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{return false;}
}

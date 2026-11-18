export function iconAssetProvider(graph){
 const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];
 const actions=new Set(nodes.filter(n=>n.type==='action').map(n=>n.id));
 return nodes.filter(n=>{
  const p=n.assetProvider,owner=String(n.id||'').split('.')[0]+'.';
  return n.type==='resource'&&p?.schema==='mas-graphics-asset-provider-1'&&p.kind==='icon'&&
   [p.listAction,p.getAction].every(a=>typeof a==='string'&&a.startsWith(owner)&&actions.has(a));
 }).sort((a,b)=>(Number(b.assetProvider.priority)||0)-(Number(a.assetProvider.priority)||0))[0]?.assetProvider||null;
}
const validIcon=data=>typeof data==='string'&&data.length<190000&&
 /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data);
export function createIconAssets(call,createImage=()=>document.createElement('img')){
 let provider=null,epoch=0,catalog={},active=new Map(),inFlight=new Map(),images=new Map();
 function paint(key,src){
  for(const img of images.get(key)||[])if(img.isConnected!==false)img.src=src;
 }
 async function load(key){
  const expected=catalog[key]?.sha256;
  if(!provider||!expected||active.get(key)?.sha256===expected)return;
  if(inFlight.has(key))return inFlight.get(key);
  const generation=epoch,action=provider.getAction;
  const job=(async()=>{
   try{
    const item=await call(action,{key});
    if(generation!==epoch||catalog[key]?.sha256!==expected||
       item?.found!==true||item.sha256!==expected||!validIcon(item.dataUri))return;
    active.set(key,{sha256:expected,dataUri:item.dataUri});paint(key,item.dataUri);
   }catch{/* leave original icon visible if asset lookup fails */}
   finally{if(inFlight.get(key)===job)inFlight.delete(key);}
  })();
  inFlight.set(key,job);return job;
 }
 function make(view){
  const img=createImage();img.alt='';
  img.src=view.iconUrl||'/icons/'+encodeURIComponent(view.icon||'workbench')+'.svg';
  if(img.dataset)img.dataset.fallback=img.src;
  if(typeof view.icon!=='string')return img;
  const key=view.icon;
  if(!images.has(key))images.set(key,new Set());
  images.get(key).add(img);
  if(active.has(key))img.src=active.get(key).dataUri;
  else if(catalog[key])void load(key);
  return img;
 }
 async function sync(graph){
  const next=iconAssetProvider(graph);
  if(provider?.getAction!==next?.getAction||provider?.listAction!==next?.listAction){
   provider=next;epoch++;catalog={};active.clear();inFlight.clear();
   for(const set of images.values())for(const img of set)
    if(img.isConnected!==false&&img.dataset?.fallback)img.src=img.dataset.fallback;
  }
  for(const [key,set] of images){
   for(const img of set)if(img.isConnected===false)set.delete(img);
   if(!set.size)images.delete(key);
  }
  if(!provider)return;
  try{
   const result=await call(provider.listAction,{});
   if(result?.schema!=='mas-graphics-icon-catalog-1'||!result.items||
      typeof result.items!=='object'||Array.isArray(result.items))return;
   catalog=result.items;
   for(const key of images.keys())if(catalog[key])void load(key);
  }catch{/* no graphics provider must never break shell startup */}
 }
 return {make,sync};
}

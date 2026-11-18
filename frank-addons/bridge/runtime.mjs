import {frankCatalog} from './catalog.mjs';
import {loadRegistry,packageDigest} from './approval.mjs';
const base='frankenstein';
async function call(port,route,secret,body){
 const res=await fetch('http://127.0.0.1:'+port+route,{
  method:body?'POST':'GET',signal:AbortSignal.timeout(body?8000:500),
  headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined
 });
 if(!res.ok)throw Error('adapter_http_'+res.status);
 const size=Number(res.headers.get('content-length')||0);
 if(size>1048576)throw Error('adapter_response_limit');
 const raw=await res.text();
 if(raw.length>1048576)throw Error('adapter_response_limit');
 return JSON.parse(raw);
}
export async function snapshot(root,secret=''){
 const registry=await loadRegistry();
 const approved=new Map(registry.packages.map(x=>[x.key,x.digest]));
 const adapters=new Map(registry.adapters.map(x=>[x.capability,x.port]));
 const routes=new Map(),packages=[];
 for(const pkg of await frankCatalog(root)){
  if(!approved.has(pkg.key)||!adapters.has(pkg.manifest.adapter))continue;
  try{
   if(await packageDigest(pkg.directory)!==approved.get(pkg.key))continue;
   const port=adapters.get(pkg.manifest.adapter);
   const health=await call(port,'/health',secret);
   if(health.protocol!=='frank-adapter-1'||health.adapter!==pkg.manifest.adapter)continue;
   const actions=pkg.manifest.actions||[];
   packages.push({key:pkg.key,language:pkg.language,name:pkg.manifest.name,
    version:pkg.manifest.version,actions:actions.map(a=>a.id)});
   for(const a of actions)routes.set(base+'.'+pkg.language+'.'+pkg.id+'.'+a.id,
    {pkg,port,action:a.id,title:a.title});
  }catch{continue;}
 }
 return {routes,packages};
}
export async function bridgeGraph(root,secret){
 const {routes}=await snapshot(root,secret);
 const nodes=[
  {id:base+'.view',type:'view',title:'Frankenstein Bridge',icon:'studio',requires:['frankenstein.read']},
  {id:base+'.list',type:'action',title:'Frank Addons',requires:['frankenstein.read']}
 ],edges=[{from:base+'.view',to:base+'.list',type:'uses'}];
 for(const [id,route] of routes){
  nodes.push({id,type:'action',title:route.title,requires:['frankenstein.invoke']});
  edges.push({from:base+'.view',to:id,type:'uses'});
 }
 return {app:base,version:1,nodes,edges};
}
export async function bridgeInvoke(root,secret,action,params){
 const {packages,routes}=await snapshot(root,secret);
 if(action===base+'.list')return {packages};
 const selected=routes.get(action);
 if(!selected)throw Error('capability_unavailable');
 const {pkg,port}=selected;
 const response=await call(port,'/invoke',secret,{protocol:'frank-adapter-1',
  action:selected.action,params:params||{},package:{key:pkg.key,language:pkg.language,
   id:pkg.id,directory:pkg.directory,entry:pkg.entry}});
 if(!Object.prototype.hasOwnProperty.call(response,'result'))throw Error('invalid_adapter_response');
 return response.result;
}

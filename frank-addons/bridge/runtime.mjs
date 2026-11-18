import {frankCatalog} from './catalog.mjs';
import {loadRegistry,packageDigest} from './approval.mjs';
import {assertFrankValue} from './values.mjs';
const base='frankenstein';
async function call(port,route,secret,body){
 const res=await fetch('http://127.0.0.1:'+port+route,{
  method:body?'POST':'GET',signal:AbortSignal.timeout(body?18000:500),
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
  if(!approved.has(pkg.key)||!adapters.has(pkg.manifest.adapter)||pkg.manifest.permissions.length)continue;
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
 if(routes.size>=2){
  nodes.push({id:base+'.pipe',type:'action',title:'Frank pipeline',requires:['frankenstein.invoke']});
  edges.push({from:base+'.view',to:base+'.pipe',type:'uses'});
 }
 return {app:base,version:1,nodes,edges};
}
async function invokeSelected(selected,secret,params){
 const {pkg,port}=selected;
 const response=await call(port,'/invoke',secret,{protocol:'frank-adapter-1',
  action:selected.action,params:assertFrankValue(params),
  package:{key:pkg.key,language:pkg.language,id:pkg.id,
   directory:pkg.directory,entry:pkg.entry}});
 if(!response||!Object.hasOwn(response,'result'))throw Error('invalid_adapter_response');
 return assertFrankValue(response.result);
}
export async function bridgeInvoke(root,secret,action,params){
 const {packages,routes}=await snapshot(root,secret);
 if(action===base+'.list')return {packages};
 if(action===base+'.pipe'){
  if(routes.size<2||!params||typeof params!=='object'||
   typeof params.from!=='string'||typeof params.to!=='string'||
   !Object.hasOwn(params,'input'))throw Error('invalid_pipeline');
  const source=routes.get(params.from);
  if(!source||!routes.has(params.to))throw Error('capability_unavailable');
  const value=await invokeSelected(source,secret,assertFrankValue(params.input));
  // A plugin may be disabled while its predecessor runs. Re-resolve.
  const fresh=(await snapshot(root,secret)).routes.get(params.to);
  if(!fresh)throw Error('capability_unavailable');
  return invokeSelected(fresh,secret,{input:value});
 }
 const selected=routes.get(action);
 if(!selected)throw Error('capability_unavailable');
 return invokeSelected(selected,secret,params||{});
}

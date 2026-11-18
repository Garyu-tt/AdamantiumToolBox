import {createCapabilityRegistry} from './registry.mjs';
const cap=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const ver=/^\d+\.\d+$/;
export function registryFromGraphs(apps,{nodeId,invoke}){
 const registry=createCapabilityRegistry();
 for(const {app,nodes} of apps){
  const capabilities=nodes.filter(n=>n.type==='action'&&cap.test(n.capability||'')&&
   ver.test(n.capabilityVersion||'')&&['read','write'].includes(n.operation)&&
   Array.isArray(n.requires)&&n.requires.length===1&&cap.test(n.requires[0]))
   .map(n=>({name:n.capability,version:n.capabilityVersion,
    operation:n.operation,permission:n.requires[0],action:n.id}));
  if(!capabilities.length)continue;
  registry.register({id:app.id,nodeId,transport:'local',primary:true,capabilities,
   invoke:(action,params)=>invoke(app,action,params)});
 }
 return registry;
}

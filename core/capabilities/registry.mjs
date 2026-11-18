const id=/^[a-z][a-z0-9_-]{1,39}(\.[a-z][a-z0-9_-]{1,39})*$/;
const cap=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
const ver=/^\d+\.\d+$/;
const compatible=(have,want)=>{
 const [hm,hn]=have.split('.').map(Number),[wm,wn]=want.split('.').map(Number);
 return hm===wm&&hn>=wn;
};
const fail=code=>{throw Error(code);};
export function createCapabilityRegistry(){
 const entries=new Map();
 function register(p){
  if(!p||!id.test(p.id||'')||!id.test(p.nodeId||'')||entries.has(p.id))fail('invalid_provider');
  if(!['local','remote'].includes(p.transport)||typeof p.invoke!=='function')fail('invalid_transport');
  if(p.transport==='remote'&&(!p.approved||!p.identityVerified))fail('untrusted_remote_provider');
  if(!Array.isArray(p.capabilities)||!p.capabilities.length)fail('missing_capabilities');
  if(p.priority!==undefined&&(!Number.isInteger(p.priority)||Math.abs(p.priority)>1000))fail('invalid_priority');
  const names=new Set();
  for(const c of p.capabilities){
   if(!c||!cap.test(c.name||'')||!ver.test(c.version||'')||
      !['read','write'].includes(c.operation)||typeof c.action!=='string'||!cap.test(c.action)||
      (c.permission!==undefined&&!cap.test(c.permission)))fail('invalid_capability');
   if(names.has(c.name))fail('duplicate_capability');names.add(c.name);
  }
  entries.set(p.id,{...p,healthy:p.healthy!==false,priority:p.priority||0,
   capabilities:p.capabilities.map(c=>({...c}))});
 }
 function unregister(id){return entries.delete(id);}
 function setHealth(id,healthy){const p=entries.get(id);if(!p)fail('unknown_provider');p.healthy=healthy===true;}
 function list(){return [...entries.values()].map(p=>({id:p.id,nodeId:p.nodeId,
  transport:p.transport,healthy:p.healthy,priority:p.priority,primary:p.primary===true,
  capabilities:p.capabilities.map(c=>({name:c.name,version:c.version,operation:c.operation}))}));}
 function resolve({name,version,operation,scopes=[],nodeId,providerId}={}){
  if(!cap.test(name||'')||!ver.test(version||'')||!['read','write'].includes(operation)||
    !Array.isArray(scopes)||!scopes.every(x=>typeof x==='string'))fail('invalid_request');
  let choices=[];
  for(const p of entries.values()){
   if(!p.healthy||(nodeId&&p.nodeId!==nodeId)||(providerId&&p.id!==providerId))continue;
   const c=p.capabilities.find(c=>c.name===name&&c.operation===operation&&
    compatible(c.version,version)&&(!c.permission||scopes.includes(c.permission)));
   if(c)choices.push({provider:p,contract:c});
  }
  if(!choices.length)fail('capability_unavailable');
  if(operation==='write'&&!providerId&&!nodeId){
   const primaries=choices.filter(x=>x.provider.primary===true);
   if(primaries.length!==1)fail('write_target_ambiguous');
   choices=primaries;
  }
  choices.sort((a,b)=>b.provider.priority-a.provider.priority||a.provider.id.localeCompare(b.provider.id));
  if(operation==='write'&&choices.length>1)fail('write_target_ambiguous');
  return choices[0];
 }
 async function invoke(request){
  const selected=resolve(request);
  // Never retry after an ambiguous response; callers must read back by idempotency key.
  return selected.provider.invoke(selected.contract.action,request.params||{},
   {providerId:selected.provider.id,nodeId:selected.provider.nodeId,operation:request.operation});
 }
 return {register,unregister,setHealth,list,resolve,invoke};
}

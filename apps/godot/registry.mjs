const schema='mas-world-engine-provider-1';
const kinds=new Set(['engine.inspect','project.check','session.start','session.status','session.stop']);
function endpoint(){
 const value=process.env.ADA_CORE_URL,token=process.env.ADA_TOKEN;
 if(!value||!token||token.length<24)throw Error('core_unavailable');
 const url=new URL(value);
 if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||
  !url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
  throw Error('core_must_be_loopback');
 return url.origin;
}
async function core(path,params){
 const r=await fetch(endpoint()+path,{method:params?'POST':'GET',
  headers:{Authorization:'Bearer '+process.env.ADA_TOKEN,'Content-Type':'application/json'},
  body:params?JSON.stringify(params):undefined,signal:AbortSignal.timeout(11000)});
 if(!r.ok)throw Error('core_http_'+r.status);
 const data=await r.json();if(data.error)throw Error(data.error);
 return params?data.result:data;
}
export async function providers(){
 const graph=await core('/api/graph');
 const actions=new Set(graph.nodes.filter(n=>n.type==='action').map(n=>n.id));
 const found=[];
 for(const n of graph.nodes){
  const p=n.provider;
  if(n.type!=='resource'||p?.schema!==schema||!Array.isArray(p.operations))continue;
  const prefix=n.id.split('.')[0]+'.',operations={};
  for(const op of p.operations){
   if(!kinds.has(op.kind)||typeof op.action!=='string'||!op.action.startsWith(prefix)||
    !actions.has(op.action))continue;
   operations[op.kind]=op.action;
  }
  if(!operations['engine.inspect'])continue;
  found.push({id:n.id,engine:p.engine,locality:p.locality==='remote'?'remote':'local',
   version:p.version,features:Array.isArray(p.features)?p.features:[],operations});
 }
 return found;
}
export async function dispatch(kind,p={}){
 if(!kinds.has(kind)||!p||typeof p!=='object'||Array.isArray(p))throw Error('invalid_request');
 if(p.providerId!==undefined&&typeof p.providerId!=='string')throw Error('invalid_provider');
 if(kind.startsWith('session.')&&kind!=='session.start'&&!p.providerId)
  throw Error('provider_id_required');
 const matches=(await providers()).filter(x=>x.operations[kind]&&
  (!p.providerId||p.providerId===x.id)&&(x.locality==='local'||p.allowRemote===true));
 matches.sort((a,b)=>(a.locality==='local'?0:1)-(b.locality==='local'?0:1)||
  a.id.localeCompare(b.id));
 if(!matches.length)throw Error('no_eligible_world_engine');
 const selected=matches[0],params={...p};
 delete params.providerId;delete params.allowRemote;
 const result=await core('/api/invoke',{action:selected.operations[kind],params});
 return {...result,providerId:selected.id};
}

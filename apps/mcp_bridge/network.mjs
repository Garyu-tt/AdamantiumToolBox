import {nodes,credential} from './config.mjs';
const timeout=Number(process.env.ADA_MCP_UPSTREAM_TIMEOUT_MS||5000);
function need(ok,why){if(!ok)throw Error(why);}
async function remote(n,url,path,body){
 const token=credential(n);
 const r=await fetch(url+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(Math.max(1000,Math.min(timeout,20000))),
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 need(r.ok,'upstream_'+r.status);
 const result=await r.json();need(result&&typeof result==='object','bad_response');return result;
}
async function readOne(n){
 const faults=[];
 for(const url of n.urls){try{
  const graph=await remote(n,url,'/api/graph');
  need(graph.version===1&&Array.isArray(graph.nodes),'incompatible_graph');
  return {id:n.id,status:'reachable',nodes:graph.nodes,edges:graph.edges||[],endpointIndex:n.urls.indexOf(url)};
 }catch(e){faults.push(String(e.message).slice(0,80));}}
 return {id:n.id,status:'unreachable',nodes:[],edges:[],errors:faults};
}
export async function topology(){
 const declared=await nodes();return Promise.all(declared.map(readOne));
}
export async function capabilities(target){
 const all=await topology();
 return target?all.find(n=>n.id===target)??{error:'unknown_node'}:all;
}
export async function invoke(target,action,params={}){
 need(typeof target==='string'&&typeof action==='string','target_and_action_required');
 need(params&&typeof params==='object'&&!Array.isArray(params),'params_must_be_object');
 const declared=await nodes(),n=declared.find(x=>x.id===target);
 need(n,'unknown_node');need(n.allow.has(action),'action_not_approved');
 // No retry after POST. A timeout may mean the action already happened.
 const selected=await readOne(n);need(selected.status==='reachable','target_unavailable');
 need(selected.nodes.some(x=>x.id===action&&x.type==='action'),'capability_unavailable');
 return {node_id:n.id,action,result:await remote(n,n.urls[selected.endpointIndex],'/api/invoke',{action,params})};
}

import {randomBytes,verify,createPublicKey} from 'node:crypto';
import {nodes,credential} from './config.mjs';
const timeout=Number(process.env.ADA_MCP_UPSTREAM_TIMEOUT_MS||5000);
function need(ok,why){if(!ok)throw Error(why);}
async function remote(n,url,path,body,extra={}){
 const token=credential(n);
 const r=await fetch(url+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(Math.max(1000,Math.min(timeout,20000))),
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
 need(r.ok,'upstream_'+r.status);
 const result=await r.json();need(result&&typeof result==='object','bad_response');return result;
}
async function authenticate(n,url){
 need(n.identity,'identity_pin_required');
 const challenge=randomBytes(24).toString('hex');
 const reply=await remote(n,url,'/api/identity?challenge='+challenge);
 need(reply.schema==='adamantium.core.identity.v1'&&reply.challenge===challenge&&reply.id===n.identity.id,'identity_mismatch');
 need(typeof reply.signature==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(reply.signature),'bad_identity_signature');
 const sig=Buffer.from(reply.signature,'base64');need(sig.length===64,'bad_identity_signature');
 const data='adamantium.core.identity.v1\n'+reply.id+'\n'+challenge;
 need(verify(null,Buffer.from(data),createPublicKey(n.identity.publicKey),sig),'bad_identity_signature');
}
async function readOne(n,primaryOnly=false){
 const faults=[],urls=primaryOnly?n.urls.slice(0,1):n.urls;
 for(const url of urls){try{
  await authenticate(n,url);
  const graph=await remote(n,url,'/api/graph');
  need(graph.version===1&&Array.isArray(graph.nodes),'incompatible_graph');
  const index=n.urls.indexOf(url),canInvoke=index===0;
  const visible=graph.nodes.filter(x=>x.type!=='action'||(canInvoke&&n.allow.has(x.id)));
  const ids=new Set(visible.map(x=>x.id));
  return {id:n.id,status:canInvoke?'reachable':'read_only_standby',identity:'verified',
   canInvoke,nodes:visible,edges:(graph.edges||[]).filter(x=>ids.has(x.from)&&ids.has(x.to)),endpointIndex:index};
 }catch(e){faults.push(String(e.message).slice(0,80));}}
 return {id:n.id,status:n.identity?'unreachable':'identity_unconfigured',canInvoke:false,nodes:[],edges:[],errors:faults};
}
export async function topology(declared){
 if(!declared)declared=await nodes();
 return Promise.all(declared.map(x=>readOne(x)));
}
export async function capabilities(target){
 const all=await topology();return target?all.find(n=>n.id===target)??{error:'unknown_node'}:all;
}
export async function invoke(target,action,params={}){
 need(typeof target==='string'&&typeof action==='string','target_and_action_required');
 need(params&&typeof params==='object'&&!Array.isArray(params),'params_must_be_object');
 const declared=await nodes(),n=declared.find(x=>x.id===target);
 need(n,'unknown_node');need(n.allow.has(action),'action_not_approved');
 need(n.identity,'identity_pin_required');
 // Never fall back to a standby endpoint for an action, even if the primary fails.
 const primary=await readOne(n,true);need(primary.status==='reachable','primary_unavailable');
 need(primary.nodes.some(x=>x.id===action&&x.type==='action'),'capability_unavailable');
 return {node_id:n.id,action,result:await remote(n,n.urls[0],'/api/invoke',{action,params},
  {'X-Adamantium-Target-Node':n.identity.id})};
}

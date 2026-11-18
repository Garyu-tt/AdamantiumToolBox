import {createHash} from 'node:crypto';
import {nodes} from './config.mjs';
import {topology} from './network.mjs';
function digest(entries){
 const safe=[...entries].sort((a,b)=>a.id.localeCompare(b.id)).map(n=>({id:n.id,urls:n.urls,tokenEnv:n.tokenEnv,
  identity:n.identity,allow:[...n.allow].sort()}));
 return createHash('sha256').update(JSON.stringify(safe)).digest('hex');
}
export async function readiness(){
 try{
  const approved=await nodes();
  if(!approved.length)return {ready:false,mode:'not_configured',primary:0,standby:0};
  const states=await topology(approved);
  const primary=states.filter(s=>s.status==='reachable'&&s.canInvoke===true).length;
  const standby=states.filter(s=>s.status==='read_only_standby'&&s.canInvoke===false).length;
  return {schema:'adamantium.mcp.ingress.v1',ready:primary+standby>0,
   mode:primary>0?'write_ready':standby>0?'read_only':'unavailable',
   primary,standby,configured:approved.length,policySha256:digest(approved)};
 }catch{return {schema:'adamantium.mcp.ingress.v1',ready:false,mode:'unavailable',primary:0,standby:0};}
}

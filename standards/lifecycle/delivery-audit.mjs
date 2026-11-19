import {createServer} from 'node:net';

const validPort=n=>Number.isInteger(n)&&n>=1024&&n<=65535;
const fail=(id,reason,detail=null)=>({id,state:'blocked',reason,...(detail?{detail}:{})});
export async function auditSnapshot({bundled=[],selected=[],permissions=[],graphIds=null,probe}){
 if(typeof probe!=='function')throw Error('health_probe_required');
 const owners=new Map(),ids=new Set(),results=[];
 for(const app of bundled){
  if(typeof app.id!=='string'||!validPort(app.port)||owners.has(app.port))
   throw Error('invalid_bundled_catalog');
  owners.set(app.port,{id:app.id,kind:'bundled'});
 }
 for(const app of selected){
  const id=app.id,port=app.port;
  if(ids.has(id)){results.push(fail(id,'duplicate_selected_id'));continue;}
  ids.add(id);
  if(!validPort(port)){results.push(fail(id,'invalid_port'));continue;}
  if(!app.verified){results.push(fail(id,'signature_or_content_unverified'));continue;}
  if(!Array.isArray(app.permissions)||!app.permissions.every(x=>permissions.includes(x))){
   results.push(fail(id,'missing_owner_permission'));continue;
  }
  if(owners.has(port)){
   results.push(fail(id,'port_reserved',owners.get(port).id));continue;
  }
  owners.set(port,{id,kind:'plugin'});
  let health;
  try{health=await probe(port,id);}
  catch{results.push(fail(id,'health_unreachable'));continue;}
  if(health?.app!==id){
   results.push(fail(id,'health_wrong_app',health?.app||'unidentified'));continue;
  }
  if(health.version!==undefined&&health.version!==app.version){
   results.push(fail(id,'health_wrong_version'));continue;
  }
  if(graphIds===null){
   results.push({id,state:'partial',reason:'authenticated_graph_not_checked',
    version:app.version,hash:app.hash});
   continue;
  }
  if(![...graphIds].some(node=>node.startsWith(id+'.'))){
   results.push(fail(id,'graph_missing'));continue;
  }
  results.push({id,state:'verified',version:app.version,hash:app.hash,port});
 }
 return {results,allVerified:results.every(x=>x.state==='verified'),
  verifiedCount:results.filter(x=>x.state==='verified').length,
  blockedCount:results.filter(x=>x.state==='blocked').length,
  graphChecked:graphIds!==null,portOwners:[...owners].map(([port,owner])=>({port,...owner}))};
}
export async function portAvailable(port){
 if(!validPort(port))return false;
 const server=createServer();
 return new Promise(resolve=>{
  server.once('error',()=>resolve(false));
  server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
 });
}
// Advisory only: the Lifecycle plan must recheck the port and registry revision.
export async function proposePort(reserved,isAvailable=portAvailable){
 const used=new Set(reserved);
 const largest=Math.max(1023,...used);
 for(let i=0;i<64512;i++){
  const candidate=1024+((largest+1-1024+i)%64512);
  if(!used.has(candidate)&&await isAvailable(candidate))return candidate;
 }
 throw Error('no_free_port');
}

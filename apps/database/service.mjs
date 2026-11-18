import http from 'node:http';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadModules} from './runtime/loader.mjs';
import {parseStoragePolicy} from './storage-policy.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const home=process.env.LOCALAPPDATA||process.env.XDG_DATA_HOME||join(homedir(),'.local','share');
const dataDir=resolve(process.env.ADA_PROBE_DATA_DIR||process.env.DATABASE_DATA_DIR||join(home,'Adamantium Toolbox','database'));
const source=resolve(fileURLToPath(new URL('modules/',import.meta.url)));
let policy={};try{policy=JSON.parse(process.env.DATABASE_MODULE_POLICY||'{}');}catch{throw Error('invalid_module_policy');}
if(!policy||Array.isArray(policy)||typeof policy!=='object')throw Error('invalid_module_policy');
const storagePolicy=parseStoragePolicy(process.env.DATABASE_STORAGE_POLICY);
const runtime=await loadModules(source,{policy,context:{dataDir,storagePolicy}});
const visible=new Map([...runtime.actions].filter(([,a])=>storagePolicy.allowWrites||a.operation!=='write'));
const nodes=[{id:'database.view',type:'view',title:'Database',icon:'database',requires:['database.read']}];
for(const [id,action] of visible){
 nodes.push({id,type:'action',title:action.name,capability:action.name,
  module:action.owner,requires:[action.permission],
  capabilityVersion:action.version,operation:action.operation});
}
nodes.push({id:'database.modules',type:'action',title:'Modules',requires:['database.read']});
const graph={app:'database',version:1,nodes,edges:nodes.slice(1).map(n=>({from:'database.view',to:n.id,type:'uses'}))};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'database',modules:runtime.status});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let body='';req.on('data',d=>{body+=d;if(body.length>262144)req.destroy();});
  req.on('end',async()=>{try{
   const call=JSON.parse(body),action=visible.get(call.action);
   if(call.action==='database.modules')return send(res,200,{result:runtime.status});
   if(!action)throw Error('capability_unavailable');
   send(res,200,{result:await action.run(call.params||{})});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8895),'127.0.0.1');
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{
 Promise.all([...runtime.services.values()].filter(s=>s&&typeof s.close==='function').map(s=>s.close()))
  .finally(()=>process.exit(0));
});

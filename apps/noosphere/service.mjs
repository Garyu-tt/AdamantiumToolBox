import http from 'node:http';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadModules} from './runtime/loader.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
let policy={};
try{policy=JSON.parse(process.env.NOOSPHERE_MODULE_POLICY||'{}');}
catch{throw Error('invalid_module_policy');}
if(!policy||Array.isArray(policy)||typeof policy!=='object')throw Error('invalid_module_policy');
const source=resolve(fileURLToPath(new URL('modules/',import.meta.url)));
const runtime=await loadModules(source,{policy});
const state=()=>({schema:'noosphere-status-v1',app:'noosphere',version:'0.3.0',
 mode:'stateless',persistent:false,storage:'not_connected',modules:runtime.status});
const nodes=[{id:'noosphere.view',type:'view',title:'Noosphere 3.0',
 icon:'graph',requires:['noosphere.read']}];
for(const [id,a] of runtime.actions)nodes.push({id,type:'action',title:a.name,
 capability:a.name,capabilityVersion:a.version,operation:a.operation,
 module:a.owner,requires:[a.permission]});
for(const name of ['status','modules'])nodes.push({id:'noosphere.'+name,
 type:'action',title:name,requires:['noosphere.read']});
const graph={app:'noosphere',version:1,nodes,
 edges:nodes.slice(1).map(n=>({from:'noosphere.view',to:n.id,type:'uses'}))};
const send=(res,code,data)=>{res.writeHead(code,
 {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,state());
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',tooLarge=false;
  req.on('data',d=>{raw+=d;if(raw.length>131072){tooLarge=true;req.destroy();}});
  req.on('end',async()=>{if(tooLarge)return;
   try{
    const call=JSON.parse(raw);
    if(call.action==='noosphere.status')return send(res,200,{result:state()});
    if(call.action==='noosphere.modules')return send(res,200,{result:runtime.status});
    const action=runtime.actions.get(call.action);
    if(!action)throw Error('capability_unavailable');
    return send(res,200,{result:await action.run(call.params||{})});
   }catch(e){return send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8896),'127.0.0.1');

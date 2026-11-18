import http from 'node:http';
import {catalog} from './catalog.mjs';
import {validateGraph} from './contract.mjs';
import {standardApi} from './api.mjs';
import {signedIdentity,assertTargetNode} from './identity.mjs';
import {semanticApi} from './semantic_api.mjs';
import {linkTree} from './linkfs.mjs';
import {resolveAsset} from './assets.mjs';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const token=process.env.ADA_TOKEN||'',secret=process.env.ADA_INTERNAL_KEY||'';
const caps=new Set((process.env.ADA_CAPS||'').split(','));
if(token.length<24||secret.length<24)throw Error('Missing secure keys');
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const authorized=req=>req.headers.authorization==='Bearer '+token;
async function upstream(url,body,timeout=1200){
 const r=await fetch(url,{method:body?'POST':'GET',signal:AbortSignal.timeout(timeout),
 headers:{'X-Internal-Key':secret,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error('upstream_'+r.status);
 return r.json();
}
async function graph(){
 const nodes=[],edges=[],routes=new Map(),seen=new Set(),connections=[];
 for(const app of await catalog(root)){
  if(!/^[a-z0-9_-]+$/.test(app.id)||!Number.isInteger(app.service.port))continue;
  const host='http://127.0.0.1:'+app.service.port;
  let spec;try{spec=await upstream(host+'/graph');}catch{continue;}
  if(!validateGraph(spec,app))continue;
  const local=[];
  for(const node of spec.nodes){
   if(typeof node.id!=='string'||!node.id.startsWith(app.id+'.')||seen.has(node.id))continue;
   if(!['view','action','resource','event'].includes(node.type))continue;
   if(!Array.isArray(node.requires)||!node.requires.every(c=>caps.has(c)))continue;
   const item={...node};delete item.requires;
   if(node.type==='view'){
    item.entry='/apps/'+app.id+'/'+(app.hash?app.hash+'/':'')+'view.js';
    if(app.source==='plugin'&&app.assets?.includes('icon.svg'))item.iconUrl='/apps/'+app.id+'/'+app.hash+'/icon.svg';
    if(app.source==='plugin'&&app.assets?.includes('icon.ico'))item.iconFile=resolve(app.directory,'icon.ico');
   }
   if(node.type==='action')routes.set(node.id,{url:host+'/invoke',
    timeout:app.service.invokeTimeoutMs||1200});
   seen.add(node.id);local.push(item);
  }
  if(Array.isArray(app.connections))connections.push(...app.connections.map(c=>({...c,owner:app.id})));
  nodes.push(...local);
  const ids=new Set(local.map(n=>n.id));
  edges.push(...(spec.edges||[]).filter(e=>ids.has(e.from)&&ids.has(e.to)));
 }
 for(const c of connections){
  if(typeof c.from!=='string'||!c.from.startsWith(c.owner+'.'))continue;
  if(!seen.has(c.from)||!seen.has(c.to))continue;
  if(!['related','opens','depends','consumes'].includes(c.type))continue;
  edges.push({from:c.from,to:c.to,type:c.type});
 }
 return {doc:{version:1,nodes,edges},routes};
}
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.ico':'image/x-icon'};
async function asset(req,res){
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  const apps=new Map((await catalog(root)).map(a=>[a.id,{directory:a.directory,hash:a.hash}]));
  const path=await resolveAsset(root,url.pathname,apps);
  const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'",
  'X-Content-Type-Options':'nosniff'});res.end(body);
 }catch{reply(res,404,{error:'not_found'});}
}

http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(await standardApi(req,res,{reply,token,secret,caps}))return;
 if(await semanticApi(req,res,{reply,token,secret,caps,backend:async()=>(await graph()).doc}))return;
 if(url.pathname==='/api/identity'){
  if(req.method!=='GET')return reply(res,405,{error:'method'});
  if(!authorized(req))return reply(res,401,{error:'unauthorized'});
  try{return reply(res,200,await signedIdentity(url.searchParams.get('challenge')));}
  catch(e){return reply(res,e.message==='invalid_challenge'?400:503,{error:String(e.message).slice(0,80)});}
 }
 if(url.pathname==='/health')return reply(res,200,{service:'Adamantium Toolbox',version:1});
 if(req.method==='GET'&&url.pathname==='/api/navigation'){
  if(!authorized(req))return reply(res,401,{error:'unauthorized'});
  try{return reply(res,200,await linkTree(root,(await graph()).doc));}
  catch{return reply(res,503,{error:'navigation_failed'});}
 }
 if(req.method==='GET'&&url.pathname==='/api/graph'){
  if(!authorized(req))return reply(res,401,{error:'unauthorized'});
  try{return reply(res,200,(await graph()).doc);}catch{return reply(res,503,{error:'graph_failed'});}
 }
 if(req.method==='POST'&&url.pathname==='/api/invoke'){
  if(!authorized(req))return reply(res,401,{error:'unauthorized'});
  if(req.headers['x-adamantium-target-node']){
   try{await assertTargetNode(req.headers['x-adamantium-target-node']);}
   catch{return reply(res,409,{error:'node_identity_mismatch'});}
  }
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>262144)req.destroy();});
  req.on('end',async()=>{try{
   const body=JSON.parse(raw),routes=(await graph()).routes;
   if(!routes.has(body.action))return reply(res,403,{error:'capability_unavailable'});
   const destination=routes.get(body.action);
   reply(res,200,await upstream(destination.url,{action:body.action,params:body.params||{}},destination.timeout));
  }catch(e){reply(res,400,{error:String(e.message).slice(0,100)});}});
  return;
 }
 if(req.method!=='GET')return reply(res,405,{error:'method'});
 await asset(req,res);
}).listen(Number(process.env.ADA_PORT||8880),'127.0.0.1');

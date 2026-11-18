import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateManifest} from '../core/contract.mjs';
import {validateModules} from './modules.mjs';
import {makeGraph} from './graph.mjs';
const slug=/^[a-z][a-z0-9_-]{1,39}$/;
const js=v=>JSON.stringify(v);
export async function generateApp(root,{id,name=id,port,icon='studio'}){
 if(!slug.test(id)||!slug.test(icon)||!Number.isInteger(port)||
  port<1024||port>65535||typeof name!=='string'||!name||name.length>80)
  throw Error('invalid_generator_options');
 const scope=id+'.read',view=id+'.view',action=id+'.ping';
 const manifest={mas:'1.0',id,name,version:'0.1.0',icon,lifecycle:'independent',
  service:{protocol:'mas-http-1',port},ui:{standard:'mas-ui-1',mode:'embedded-and-standalone'},
  auth:{mode:'host-delegated'},permissions:[scope],events:{schema:'mas-event-1'},
  data:{refs:'mas-ref-1'},updates:{strategy:'semver',migrations:[]}};
 const modules={schema:'mas-modules-1',app:id,modules:[{
  id:id+'.root',kind:'module',version:'0.1.0',enabled:true,
  provides:[{id:view,type:'view',title:name,version:'1.0.0',permissions:[scope]},
   {id:action,type:'action',title:'Ping',version:'1.0.0',permissions:[scope],
    input:{type:'object',additionalProperties:false},output:{type:'object',
     required:['pong'],properties:{pong:{type:'boolean'}}}}],
  links:[{from:view,to:action,type:'uses'}]}]};
 if(!validateManifest(manifest))throw Error('invalid_generated_manifest');
 validateModules(modules,manifest);makeGraph(modules,manifest);
 const directory=join(root,'drafts',id);
 await mkdir(directory); // refuse overwrite; drafts must be reviewed before promotion
 const files={
  'manifest.json':JSON.stringify(manifest,null,2)+'\n',
  'modules.json':JSON.stringify(modules,null,2)+'\n',
  'handlers.mjs':`export const handlers={${js(action)}:async()=>({pong:true})};\n`,
  'service.mjs':serviceSource,
  'view.js':`export async function mount(host,{call}){\n const button=document.createElement('button'),result=document.createElement('pre');\n button.textContent='Ping';button.onclick=async()=>{try{result.textContent=JSON.stringify(await call(${js(action)},{}));}\n catch(e){result.textContent=String(e.message)}};host.append(button,result);\n}\n`
 };
 for(const [file,source] of Object.entries(files))await writeFile(join(directory,file),source,'utf8');
 await mkdir(join(directory,'runtime'));
 for(const file of ['modules.mjs','graph.mjs'])
  await copyFile(new URL('./'+file,import.meta.url),join(directory,'runtime',file));
 return {directory,files:[...Object.keys(files),'runtime/modules.mjs','runtime/graph.mjs'],manifest,modules};
}
const serviceSource=`import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {handlers} from './handlers.mjs';
import {makeGraph} from './runtime/graph.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url)));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
async function graph(){
 const doc=JSON.parse(await readFile(new URL('./modules.json',import.meta.url)));
 const spec=makeGraph(doc,manifest);
 if(spec.nodes.some(n=>n.type==='action'&&typeof handlers[n.id]!=='function'))
  throw Error('missing_action_handler');
 return spec;
}
http.createServer(async(req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph'){
  try{return send(res,200,await graph());}catch{return send(res,503,{error:'bad_graph'});}
 }
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>262144)
   return send(res,413,{error:'too_large'});}
  try{const body=JSON.parse(raw),available=await graph();
   if(!available.nodes.some(n=>n.id===body.action&&n.type==='action'))
    return send(res,403,{error:'capability_unavailable'});
   return send(res,200,{result:await handlers[body.action](body.params||{})});
  }catch(e){return send(res,400,{error:String(e.message).slice(0,120)});}
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');
`;

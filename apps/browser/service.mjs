import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {engine,config} from './engine.mjs';
import {BrowserSession} from './session.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const found=await engine(await config());
const runtime=resolve(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox');
const session=new BrowserSession(runtime);
const requires={
 'browser.settings':'browser.read','browser.tabs':'browser.read','browser.open':'browser.navigate',
 'browser.navigate':'browser.navigate','browser.screenshot':'browser.read',
 'browser.click':'browser.interact','browser.type':'browser.interact',
 'browser.stop':'browser.navigate','browser.back':'browser.navigate',
 'browser.forward':'browser.navigate','browser.reload':'browser.navigate',
 'browser.closeTab':'browser.navigate'
};
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const nodes=[
 {id:'browser.view',type:'view',title:'Chromium Browser',icon:'browser',requires:['browser.read']},
 ...Object.entries(requires).map(([id,cap])=>({id,type:'action',
  title:id.split('.')[1],requires:[cap]}))
];
const spec={app:'browser',version:1,nodes,
 edges:Object.keys(requires).map(id=>({from:'browser.view',to:id,type:'uses'}))};
const send=(res,status,data)=>{res.writeHead(status,{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));};
async function action(name,p){
 const permission=requires[name];
 if(!permission||!caps.has(permission))throw Error('capability_denied');
 if(name==='browser.settings'){const c=await config();
  return {previewRefreshMs:c.previewRefreshMs,maxTabs:c.maxTabs,viewport:c.viewport};}
 if(name==='browser.tabs')return session.pages();
 if(name==='browser.open')return session.open(p.url);
 if(name==='browser.navigate')return session.navigate(p.id,p.url);
 if(name==='browser.back')return session.history(p.id,-1);
 if(name==='browser.forward')return session.history(p.id,1);
 if(name==='browser.reload')return session.reload(p.id);
 if(name==='browser.closeTab')return session.closeTab(p.id);
 if(name==='browser.screenshot')return session.shot(p.id);
 if(name==='browser.click')return session.click(p.id,p.x,p.y);
 if(name==='browser.type')return session.type(p.id,p.text);
 if(name==='browser.stop')return session.close();
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'browser',engine:found.source});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let data='',oversized=false;
  req.on('data',chunk=>{data+=chunk;if(data.length>12000){oversized=true;req.destroy();}});
  req.on('end',async()=>{
   if(oversized)return;
   try{const body=JSON.parse(data);send(res,200,{result:await action(body.action,body.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,160)});}
  });return;
 }
 send(res,404,{error:'not_found'});
 }).listen(Number(process.env.APP_PORT||
 JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8')).service.port),'127.0.0.1');
process.on('SIGTERM',()=>{session.close().finally(()=>process.exit(0));});
process.on('SIGINT',()=>{session.close().finally(()=>process.exit(0));});

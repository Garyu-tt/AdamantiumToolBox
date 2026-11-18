import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {planLayout} from './planner.mjs';
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const has=()=>new Set((process.env.ADA_CAPS||'').split(',')).has('ui.compose');
const action='ui_composer.plan';
const graph={app:manifest.id,version:1,nodes:[
 {id:'ui_composer.view',type:'view',title:'UI Composer',icon:manifest.icon,requires:['ui.compose']},
 {id:'ui_composer.provider',type:'resource',requires:['ui.compose'],
  uiComposer:{schema:'mas-ui-composer-provider-1',planAction:action,
   modes:['automatic'],priority:20}},
 {id:action,type:'action',title:'Plan semantic layout',requires:['ui.compose']}
],edges:[{from:'ui_composer.view',to:'ui_composer.provider',type:'uses'},
 {from:'ui_composer.provider',to:action,type:'provides'}]};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;
  req.on('data',chunk=>{raw+=chunk;if(raw.length>30000){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{
    const request=JSON.parse(raw);
    if(!has()||request.action!==action)throw Error('capability_denied');
    send(res,200,{result:planLayout(request.params?.schema,request.params?.mode)});
   }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');

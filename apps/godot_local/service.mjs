import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {engine,check} from './config.mjs';
import {start,status,stop} from './sessions.mjs';
const manifest=JSON.parse(await readFile(new URL('./manifest.json',import.meta.url),'utf8'));
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const caps=new Set((process.env.ADA_CAPS||'').split(','));
const ops={
 'engine.inspect':'godot_local.engine.inspect',
 'project.check':'godot_local.project.check',
 'session.start':'godot_local.session.start',
 'session.status':'godot_local.session.status',
 'session.stop':'godot_local.session.stop'
};
const spec={app:manifest.id,version:1,nodes:[
 {id:'godot_local.view',type:'view',title:'Godot Local Provider',
  icon:manifest.icon,requires:['engine.provider']},
 {id:'godot_local.provider',type:'resource',title:'Godot Runtime',
  requires:['engine.provider'],provider:{schema:'mas-world-engine-provider-1',
   engine:'godot',version:manifest.engine.upstreamVersion,locality:'local',
   features:['cpu-headless'],operations:Object.entries(ops).map(([kind,action])=>({kind,action}))}},
 ...Object.values(ops).map(id=>({id,type:'action',title:id,requires:['engine.provider']}))
],edges:[{from:'godot_local.view',to:'godot_local.provider',type:'uses'},
 ...Object.values(ops).map(id=>({from:'godot_local.provider',to:id,type:'provides'}))]};
function send(res,code,data){
 res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
}
async function invoke(action,p){
 if(!caps.has('engine.provider'))throw Error('capability_denied');
 if(action===ops['engine.inspect'])return engine();
 if(action===ops['project.check'])return check(p.projectId);
 if(action===ops['session.start'])return start(p);
 if(action===ops['session.status'])return status(p.sessionId);
 if(action===ops['session.stop'])return stop(p.sessionId);
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';
  req.on('data',d=>{raw+=d;if(raw.length>16384)req.destroy();});
  req.on('end',async()=>{
   try{const b=JSON.parse(raw);
    send(res,200,{result:await invoke(b.action,b.params||{})});}
   catch(e){send(res,400,{error:String(e.message).slice(0,160)});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {devices,usbRoutes,inventory} from './adb.mjs';
import {providers,adapters} from './providers.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const permissions=new Set((process.env.ADA_CAPS||'').split(','));
const manifest=JSON.parse(await readFile(join(import.meta.dirname,'manifest.json'),'utf8'));
const actions={
 'xrtransport.devices':{run:devices,scope:'xrtransport.read'},
 'xrtransport.usb_routes':{run:usbRoutes,scope:'xrtransport.read'},
 'xrtransport.adapters':{run:async()=>({adapters:(await adapters()).map(({entry,...x})=>x)}),scope:'xrtransport.read'},
 'xrtransport.providers':{run:providers,scope:'xrtransport.read'},
 'xrtransport.inventory':{run:inventory,scope:'xrtransport.inventory'}
};
const nodes=[{id:'xrtransport.view',type:'view',title:'ParallaXis XR Transport',
 icon:manifest.icon,requires:['xrtransport.read']},
 ...Object.entries(actions).map(([id,a])=>({id,type:'action',requires:[a.scope]}))];
const graph={app:'xrtransport',version:1,nodes,
 edges:Object.keys(actions).map(id=>({from:'xrtransport.view',to:id,type:'uses'}))};
function send(res,status,body){
 if(res.writableEnded||res.destroyed)return;
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 res.end(JSON.stringify(body));
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:manifest.id});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let data='',overflow=false;
  req.on('data',chunk=>{
   if(overflow)return;
   data+=chunk;if(Buffer.byteLength(data)>4096){overflow=true;send(res,413,{error:'too_large'});}
  });
  req.on('end',async()=>{
   if(overflow)return;
   try{
    const payload=JSON.parse(data);
    const action=payload?.action;
    if(typeof action!=='string'||!Object.hasOwn(actions,action))
     return send(res,404,{error:'action_not_found'});
    const selected=actions[action];
    if(!permissions.has(selected.scope))return send(res,403,{error:'capability_denied'});
    send(res,200,{result:await selected.run(payload.params||{})});
   }catch{return send(res,400,{error:'invalid_request_or_probe_failed'});}
  });return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||manifest.service.port),'127.0.0.1');

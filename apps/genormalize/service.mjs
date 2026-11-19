// Pure stateless sensory normalization; not an AI model or live Genesis.
import http from 'node:http';
import {normalizeSensor} from './codec.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'genormalize',version:1,nodes:[
 {id:'genormalize.view',type:'view',title:'Genesis: нормализация',icon:'graph',requires:['genormalize.read']},
 {id:'genormalize.normalize',type:'action',title:'Нормализовать сенсорное событие',
  contract:'genesis.sensory.normalize.v1',requires:['genormalize.read']}
],edges:[{from:'genormalize.view',to:'genormalize.normalize',type:'uses'}]};
const send=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'genormalize',kind:'stateless',genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let data='',tooLarge=false;
  req.on('data',chunk=>{data+=chunk;if(Buffer.byteLength(data)>14000){tooLarge=true;req.destroy();}});
  req.on('end',()=>{if(tooLarge)return;
   try{const body=JSON.parse(data);if(body.action!=='genormalize.normalize')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:normalizeSensor(body.params?.event)});
   }catch(e){return send(res,400,{error:String(e.message).slice(0,96)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8903),'127.0.0.1');

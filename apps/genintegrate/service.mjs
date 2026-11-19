// Pure candidate-state transformation; caller owns the durable checkpoint.
import http from 'node:http';
import {integrate} from './reducer.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'genintegrate',version:1,nodes:[
 {id:'genintegrate.view',type:'view',title:'Genesis: сенсорный контекст',icon:'graph',requires:['genintegrate.read']},
 {id:'genintegrate.integrate',type:'action',title:'Интеграция наблюдений',
  contract:'genesis.sensory.integrate.v1',requires:['genintegrate.read']}
],edges:[{from:'genintegrate.view',to:'genintegrate.integrate',type:'uses'}]};
const send=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'genintegrate',stateful:false,genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;
  req.on('data',chunk=>{raw+=chunk;if(Buffer.byteLength(raw)>75000){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const body=JSON.parse(raw);if(body.action!=='genintegrate.integrate')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:integrate(body.params||{})});}
   catch(e){const conflict=/sequence_gap|sequence_conflict|sequence_regression|source_limit/.test(e.message);
    return send(res,conflict?409:400,{error:String(e.message).slice(0,110)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8904),'127.0.0.1');

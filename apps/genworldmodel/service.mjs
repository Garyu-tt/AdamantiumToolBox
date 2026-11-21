import http from 'node:http';
import {updateWorldModel} from './reducer.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'genworldmodel',version:1,nodes:[
 {id:'genworldmodel.view',type:'view',title:'Genesis: модель наблюдений',icon:'graph',requires:['genworldmodel.read']},
 {id:'genworldmodel.update',type:'action',title:'Обновить модель наблюдений',
  contract:'genesis.worldmodel.update.v1',requires:['genworldmodel.read']}
],edges:[{from:'genworldmodel.view',to:'genworldmodel.update',type:'uses'}]};
const send=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'genworldmodel',kind:'stateless',genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;
  req.on('data',part=>{raw+=part;if(Buffer.byteLength(raw)>76000){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const b=JSON.parse(raw);if(b.action!=='genworldmodel.update')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:updateWorldModel(b.params||{})});}
   catch(e){const conflict=/sequence_gap|sequence_conflict|sequence_regression|time_regression|entity_limit/.test(e.message);
    return send(res,conflict?409:400,{error:String(e.message).slice(0,110)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8905),'127.0.0.1');

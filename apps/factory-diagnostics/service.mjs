import http from 'node:http';
import {readDiagnostics} from './reader.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const source=process.env.ADA_FACTORY_DIAGNOSTICS_FILE||'';
const app='factory-diagnostics';
const graph={app,version:1,nodes:[
 {id:app+'.view',type:'view',title:'Диагностика ответов',icon:'editor',requires:['factory.read']},
 {id:app+'.sessions',type:'action',title:'Сессии',requires:['factory.read']},
 {id:app+'.events',type:'action',title:'События',requires:['factory.read']}
],edges:['sessions','events'].map(x=>({from:app+'.view',to:app+'.'+x,type:'uses'}))};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const server=http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method!=='POST'||req.url!=='/invoke')return send(res,404,{error:'not_found'});
 let text='';req.on('data',part=>{text+=part;if(text.length>8192)req.destroy();});
 req.on('end',async()=>{
  try{
   const request=JSON.parse(text),params=request.params||{};
   if(params===null||typeof params!=='object'||Array.isArray(params))throw Error('bad_params');
   if(request.action===app+'.events')return send(res,200,{result:await readDiagnostics(source,params)});
   if(request.action===app+'.sessions'){
    const raw=await readDiagnostics(source,{limit:100});
    return send(res,200,{result:{...raw,events:undefined}});
   }
   return send(res,403,{error:'forbidden'});
  }catch{return send(res,400,{error:'bad_request'});}
 });
});
server.listen(Number(process.env.APP_PORT||8899),'127.0.0.1');

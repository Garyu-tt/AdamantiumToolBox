import http from 'node:http';
import {select} from './selector.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'genselect',version:1,nodes:[
 {id:'genselect.view',type:'view',title:'Genesis: выбор действий',icon:'graph',requires:['genselect.read']},
 {id:'genselect.select',type:'action',title:'Выбрать допустимое предложение',
  contract:'genesis.policy.select.v1',requires:['genselect.read']}
],edges:[{from:'genselect.view',to:'genselect.select',type:'uses'}]};
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'genselect',mode:'simulation',genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;req.on('data',part=>{raw+=part;if(Buffer.byteLength(raw)>12000){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const x=JSON.parse(raw);if(x.action!=='genselect.select')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:select(x.params||{})});
   }catch(e){return send(res,400,{error:String(e.message).slice(0,100)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8907),'127.0.0.1');

// Stateless self-state envelope: no Genesis, durable memory or runtime authorization.
import http from 'node:http';
import {createSnapshot} from './codec.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('missing_internal_key');
const spec={app:'genselfstate',version:1,nodes:[
 {id:'genselfstate.view',type:'view',title:'Genesis: состояние',icon:'graph',requires:['genselfstate.read']},
 {id:'genselfstate.snapshot',type:'action',title:'Сформировать снимок состояния',
  contract:'genesis.selfstate.snapshot.v1',requires:['genselfstate.read']}
],edges:[{from:'genselfstate.view',to:'genselfstate.snapshot',type:'uses'}]};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'genselfstate',persistence:false,genesis:false});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='',over=false;
  req.on('data',part=>{raw+=part;if(Buffer.byteLength(raw)>150000){over=true;req.destroy();}});
  req.on('end',()=>{if(over)return;
   try{const body=JSON.parse(raw);if(body.action!=='genselfstate.snapshot')return send(res,404,{error:'unknown_action'});
    return send(res,200,{result:createSnapshot(body.params||{})});}
   catch(error){return send(res,400,{error:String(error.message).slice(0,100)});}
  });return;
 }
 return send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8908),'127.0.0.1');

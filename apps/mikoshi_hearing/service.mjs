import http from 'node:http';
import {analyze} from './features.mjs';
const key=process.env.ADA_INTERNAL_KEY||'',scope='hearing.observe';
if(key.length<24)throw Error('internal_key_missing');
const action='mikoshi_hearing.analyze';
const graph={app:'mikoshi_hearing',version:1,nodes:[
 {id:'mikoshi_hearing.view',type:'view',title:'Mikoshi Ear',icon:'studio',requires:[scope]},
 {id:'mikoshi_hearing.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'hearing',actions:{analyze:action}}},
 {id:action,type:'action',title:'Analyze PCM frame',requires:[scope]}
],edges:[{from:'mikoshi_hearing.view',to:'mikoshi_hearing.provider',type:'uses'},
 {from:'mikoshi_hearing.provider',to:action,type:'provides'}]};
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:graph.app});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph);
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>150000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);if(b.action!==action||
    !new Set((process.env.ADA_CAPS||'').split(',')).has(scope))throw Error('capability_denied');
   send(res,200,{result:analyze(b.params?.samples,b.params?.sampleRate)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,100)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8921),'127.0.0.1');

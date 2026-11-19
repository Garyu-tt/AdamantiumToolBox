import http from 'node:http';
import {compare} from './metric.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_audiometry.status',compare:'mikoshi_audiometry.compare'};
function graph(){
 const nodes=[{id:'mikoshi_audiometry.view',type:'view',icon:'studio',
  title:'Mikoshi Acoustic Feedback',requires:['audiometry.inspect']},
 {id:ids.status,type:'action',title:'Acoustic reward capability',
  requires:['audiometry.inspect']}],edges=[
 {from:'mikoshi_audiometry.view',to:ids.status,type:'uses'}];
 if(can('audiometry.compare')){
  nodes.push({id:ids.compare,type:'action',title:'Compare two aligned WAVs',
   requires:['audiometry.compare']},
   {id:'mikoshi_audiometry.provider',type:'resource',requires:['audiometry.compare'],
    skill:{schema:'mikoshi.skill.v1',domain:'acoustic-feedback',
     actions:{compare:ids.compare}}});
  edges.push({from:'mikoshi_audiometry.view',to:'mikoshi_audiometry.provider',type:'uses'},
   {from:'mikoshi_audiometry.provider',to:ids.compare,type:'provides'});
 }
 return {app:'mikoshi_audiometry',version:1,nodes,edges};
}
const send=(r,s,b)=>{r.writeHead(s,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});r.end(JSON.stringify(b));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_audiometry'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>210000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   if(b.action!==ids.compare||!can('audiometry.compare'))throw Error('capability_denied');
   send(res,200,{result:compare(b.params?.reference,b.params?.candidate)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8933),'127.0.0.1');

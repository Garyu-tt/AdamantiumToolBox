import http from 'node:http';
import {segment} from './segmenter.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='segments.observe',can=()=>new Set((process.env.ADA_CAPS||'').split(',')).has(scope);
const analyze='mikoshi_segments.analyze',status='mikoshi_segments.status';
const graph=()=>({app:'mikoshi_segments',version:1,nodes:[
 {id:'mikoshi_segments.view',type:'view',title:'Mikoshi Auditory Segments',
  icon:'studio',requires:[scope]},
 {id:'mikoshi_segments.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'auditory-events',
   actions:{analyze,status}}},
 {id:analyze,type:'action',title:'Detect acoustic events',requires:[scope]},
 {id:status,type:'action',title:'Event detector status',requires:[scope]}
],edges:[
 {from:'mikoshi_segments.view',to:'mikoshi_segments.provider',type:'uses'},
 {from:'mikoshi_segments.provider',to:analyze,type:'provides'},
 {from:'mikoshi_segments.provider',to:status,type:'provides'}
]});
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_segments'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!can())return send(res,403,{error:'capability_denied'});
  let raw='';
  req.on('data',chunk=>{raw+=chunk;if(raw.length>1200000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const result=b.action===status?{sampleRate:12000,frameMs:20,
    maxDurationMs:4000,model:'none',storage:'none',automaticLearning:false}:
    b.action===analyze?segment(b.params?.samples,b.params?.sampleRate):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8935),'127.0.0.1');

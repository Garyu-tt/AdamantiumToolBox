import http from 'node:http';
import {generate,rank} from './model.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const inspect='hypothesis.inspect',propose='hypothesis.propose';
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_hypotheses.status',
 generate:'mikoshi_hypotheses.generate',rank:'mikoshi_hypotheses.rank'};
function graph(){
 const nodes=[{id:'mikoshi_hypotheses.view',type:'view',
  title:'Mikoshi Hypothesis Lab',icon:'studio',requires:[inspect]},
 {id:ids.status,type:'action',title:'Hypothesis search status',
  requires:[inspect]}],edges=[
 {from:'mikoshi_hypotheses.view',to:ids.status,type:'uses'}];
 if(can(propose)){
  nodes.push({id:ids.generate,type:'action',
   title:'Generate bounded vocal probes',requires:[propose]},
   {id:ids.rank,type:'action',title:'Rank expected information gain',
    requires:[propose]},
   {id:'mikoshi_hypotheses.provider',type:'resource',requires:[propose],
    skill:{schema:'mikoshi.skill.v1',domain:'hypothesis-search',
     actions:{generate:ids.generate,rank:ids.rank}}});
  edges.push({from:'mikoshi_hypotheses.view',
   to:'mikoshi_hypotheses.provider',type:'uses'},
   {from:'mikoshi_hypotheses.provider',to:ids.generate,type:'provides'},
   {from:'mikoshi_hypotheses.provider',to:ids.rank,type:'provides'});
 }
 return {app:'mikoshi_hypotheses',version:1,nodes,edges};
}
const send=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
function invoke(b){
 if(b.action===ids.status){
  if(!can(inspect))throw Error('capability_denied');
  return {schema:'mikoshi.hypothesis.status.v1',
   strategy:'uncertainty-search',storage:'none',autonomousExecution:false};
 }
 if(!can(propose))throw Error('capability_denied');
 if(b.action===ids.generate)return generate(b.params?.motor,
  b.params?.stepF1,b.params?.stepF2);
 if(b.action===ids.rank)return rank(b.params?.options);
 throw Error('action_unavailable');
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')
  return send(res,200,{app:'mikoshi_hypotheses'});
 if(req.headers['x-internal-key']!==secret)
  return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>12000)req.destroy();});
  req.on('end',()=>{try{
   send(res,200,{result:invoke(JSON.parse(raw))});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8997),'127.0.0.1');

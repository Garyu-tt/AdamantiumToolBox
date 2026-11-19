import http from 'node:http';
import {anchor,render,wav,RATE} from './renderer.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_vocalstream.status',render:'mikoshi_vocalstream.render'};
function graph(){
 const nodes=[{id:'mikoshi_vocalstream.view',type:'view',icon:'studio',
  title:'Mikoshi Vocal Stream',requires:['waveform.inspect']},
 {id:ids.status,type:'action',title:'Vocal synth status',requires:['waveform.inspect']}];
 const edges=[{from:'mikoshi_vocalstream.view',to:ids.status,type:'uses'}];
 if(can('waveform.render')){
  nodes.push({id:ids.render,type:'action',title:'Synthesize continuous utterance',
   requires:['waveform.render']},
   {id:'mikoshi_vocalstream.provider',type:'resource',
    requires:['waveform.render'],
    skill:{schema:'mikoshi.skill.v1',domain:'waveform-renderer',
     actions:{render:ids.render}}});
  edges.push({from:'mikoshi_vocalstream.view',
   to:'mikoshi_vocalstream.provider',type:'uses'},
   {from:'mikoshi_vocalstream.provider',to:ids.render,type:'provides'});
 }
 return {app:'mikoshi_vocalstream',version:1,nodes,edges};
}
const send=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
function invoke(req){
 if(req.action===ids.status){
  if(!can('waveform.inspect'))throw Error('capability_denied');
  return {schema:'mikoshi.waveform.status.v1',rate:RATE,
   anchorHz:anchor(),provider:'additive-formant-stream',languageModel:false};
 }
 if(req.action!==ids.render||!can('waveform.render'))throw Error('capability_denied');
 const samples=render(req.params?.trajectory);
 return {schema:'mikoshi.waveform.wav.v1',mime:'audio/wav',
  audioBase64:wav(samples),sampleRate:RATE,durationMs:samples.length/RATE*1000,
  anchorHz:anchor(),provider:'additive-formant-stream',languageModel:false};
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_vocalstream'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>50000)req.destroy();});
  req.on('end',()=>{try{
   send(res,200,{result:invoke(JSON.parse(raw))});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8932),'127.0.0.1');

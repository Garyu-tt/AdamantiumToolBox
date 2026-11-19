import http from 'node:http';
import {calibrate,shiftAudio} from './calibrate.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
if(key.length<24)throw Error('internal_key_missing');
const scope='clock.inspect',allowed=()=>new Set(
 (process.env.ADA_CAPS||'').split(',')).has(scope);
const ids={status:'mikoshi_clockcal.status',
 estimate:'mikoshi_clockcal.estimate',shift:'mikoshi_clockcal.shift'};
function graph(){
 const nodes=[{id:'mikoshi_clockcal.view',type:'view',icon:'studio',
  title:'Mikoshi Clock Calibration Lab',requires:[scope]},
 ...Object.entries(ids).map(([name,id])=>({id,type:'action',
  title:'Clock '+name,requires:[scope]})),
 {id:'mikoshi_clockcal.provider',type:'resource',requires:[scope],
  skill:{schema:'mikoshi.skill.v1',domain:'clock-calibration',actions:ids}}];
 const edges=[{from:'mikoshi_clockcal.view',
  to:'mikoshi_clockcal.provider',type:'uses'},
  ...Object.values(ids).map(to=>({
   from:'mikoshi_clockcal.provider',to,type:'provides'}))];
 return {app:'mikoshi_clockcal',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')
  return send(res,200,{app:'mikoshi_clockcal'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  if(!allowed())return send(res,403,{error:'capability_denied'});
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>10000)req.destroy();});
  req.on('end',()=>{try{
   const b=JSON.parse(raw);
   const result=b.action===ids.status?{
    schema:'mikoshi.clockcal.status.v1',
    needsKnownCommonStimulus:true,hardwareCertified:false}:
    b.action===ids.estimate?calibrate(b.params?.cues,
     b.params?.referenceUncertaintyMs):
    b.action===ids.shift?shiftAudio(b.params?.audioEvents,
     b.params?.calibration):null;
   if(!result)throw Error('action_unavailable');
   send(res,200,{result});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8992),'127.0.0.1');

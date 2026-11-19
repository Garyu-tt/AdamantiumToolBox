import {checkPair,checkTicket,signReceipt,replay,journal} from '../../contracts/mikoshi-av-permit.mjs';
import http from 'node:http';
import {encode} from './encoder.mjs';
import {recognize,learn,catalog} from './cluster.mjs';
import {configured,load,save} from './store.mjs';
const key=process.env.ADA_INTERNAL_KEY||'';
const sourceKey=process.env.MIKOSHI_SOURCE_SIGNING_KEY||'';
const secure=Boolean(sourceKey)||process.env.MIKOSHI_REQUIRE_SOURCE_PERMIT==='1';
if(secure&&Buffer.byteLength(sourceKey)<32)throw Error('source_signing_key_missing');
if(key.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const r='motifs.inspect',w='motifs.learn';
const ids={status:'mikoshi_motifs.status',recognize:'mikoshi_motifs.recognize',
 remember:'mikoshi_motifs.remember',receipt:'mikoshi_motifs.receipt'};
function graph(){
 const nodes=[{id:'mikoshi_motifs.view',type:'view',icon:'studio',
  title:'Mikoshi Auditory Memory',requires:[r]},
 {id:ids.status,type:'action',title:'Auditory memory status',requires:[r]},
 {id:ids.recognize,type:'action',title:'Recognize acoustic motif',requires:[r]},
 {id:'mikoshi_motifs.provider',type:'resource',requires:[r],
  skill:{schema:'mikoshi.skill.v1',domain:'auditory-memory',actions:{
   status:ids.status,recognize:ids.recognize,
   ...(secure?{receipt:ids.receipt}:{}),
   ...(can(w)&&configured()?{remember:ids.remember}:{})}}}];
 const edges=[{from:'mikoshi_motifs.view',to:'mikoshi_motifs.provider',type:'uses'},
  {from:'mikoshi_motifs.provider',to:ids.recognize,type:'provides'},
  {from:'mikoshi_motifs.view',to:ids.status,type:'uses'}];
 if(secure){
  nodes.push({id:ids.receipt,type:'action',
   title:'Read signed motif receipt',requires:[r]});
  edges.push({from:'mikoshi_motifs.provider',to:ids.receipt,type:'provides'});
 }
 if(can(w)&&configured()){
  nodes.push({id:ids.remember,type:'action',title:'Learn acoustic motif',requires:[w]});
  edges.push({from:'mikoshi_motifs.provider',to:ids.remember,type:'provides'});
 }
 return {app:'mikoshi_motifs',version:1,nodes,edges};
}
const send=(res,status,doc)=>{res.writeHead(status,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(doc));};
let serial=Promise.resolve();
async function invoke(body){
 if(!can(r))throw Error('capability_denied');
 if(body.action===ids.status){const state=await load();return {...catalog(state),configured:configured(),secureSourceWrites:secure,sourceReceipts:(state.sourceWrites||[]).length};}
 if(body.action===ids.receipt&&secure){
  const proof=checkTicket(sourceKey,body.params,Date.now());
  const result=replay(await load(),proof);
  return {applied:result!==null,result};
 }
 if(body.action!==ids.recognize&&body.action!==ids.remember)
  throw Error('action_unavailable');
 const feature=encode(body.params?.samples,body.params?.sampleRate);
 if(body.action===ids.recognize)return recognize(await load(),feature.vector);
 if(!can(w)||!configured())throw Error('capability_denied');
 if(body.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const current=await load();
  const proof=secure?checkPair(sourceKey,body.params,'audio',Date.now()):null;
  if(proof){
   const seen=replay(current,proof);if(seen)return seen;
  }
  const {state,result}=learn(current,feature.vector);
  const output=proof?{...result,
   sourceReceipt:signReceipt(sourceKey,proof,result.id)}:result;
  if(proof)journal(state,proof,output);
  await save(state);return output;
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_motifs'});
 if(req.headers['x-internal-key']!==key)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>90000)req.destroy();});
  req.on('end',async()=>{try{
   const body=JSON.parse(raw);send(res,200,{result:await invoke(body)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8928),'127.0.0.1');

import http from 'node:http';
import {configured,load,save,anchor} from './store.mjs';
import {synth,wav} from './synth.mjs';
import {spectrum} from './spectrum.mjs';
import {imitate} from './learner.mjs';
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('internal_key_missing');
const can=s=>new Set((process.env.ADA_CAPS||'').split(',')).has(s);
const ids={status:'mikoshi_phonetics.status',observe:'mikoshi_phonetics.observe',
 preview:'mikoshi_phonetics.preview',imitate:'mikoshi_phonetics.imitate'};
function graph(){
 const inspect='phonetics.inspect',render='phonetics.render',learn='phonetics.learn';
 const nodes=[{id:'mikoshi_phonetics.view',type:'view',icon:'studio',
  title:'Mikoshi Articulation Lab',requires:[inspect]}],edges=[];
 const action=(id,title,scope)=>{nodes.push({id:ids[id],type:'action',
  title,requires:[scope]});edges.push({from:'mikoshi_phonetics.view',to:ids[id],type:'uses'});};
 action('status','Articulation progress',inspect);
 action('observe','Spectral hearing',inspect);
 if(can(render)&&can(inspect)){
  action('preview','Render voiced formants',render);
  const actions={preview:ids.preview,observe:ids.observe};
  if(can(learn)&&configured()){
   action('imitate','Learn from reference audio',learn);actions.imitate=ids.imitate;
  }
  nodes.push({id:'mikoshi_phonetics.provider',type:'resource',
   requires:[inspect,render],
   skill:{schema:'mikoshi.skill.v1',domain:'articulation',actions}});
  edges.push({from:'mikoshi_phonetics.view',to:'mikoshi_phonetics.provider',type:'uses'});
 }
 return {app:'mikoshi_phonetics',version:1,nodes,edges};
}
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
let serial=Promise.resolve();
async function invoke(b){
 if(b.action===ids.status){
  if(!can('phonetics.inspect'))throw Error('capability_denied');
  const s=await load();return {...s,learningEnabled:configured()};
 }
 if(b.action===ids.observe){
  if(!can('phonetics.inspect'))throw Error('capability_denied');
  return {schema:'mikoshi.phonetics.spectrum.v1',
   vector:spectrum(b.params?.samples,b.params?.sampleRate)};
 }
 if(b.action===ids.preview){
  if(!can('phonetics.render'))throw Error('capability_denied');
  const s=await load(),motor=b.params?.motor||s.motor,samples=synth(motor,anchor());
  return {mime:'audio/wav',audioBase64:wav(samples),samples,sampleRate:12000,
   pitchHz:anchor(),motor,provider:'formant-oscillator',languageModel:false};
 }
 if(b.action!==ids.imitate||!can('phonetics.learn')||
  !can('phonetics.render')||!configured())throw Error('capability_denied');
 if(b.params?.sourceApproved!==true)throw Error('source_permission_required');
 const task=serial.then(async()=>{
  const state=await load();
  const {state:next,result}=imitate(state,b.params?.samples,b.params?.sampleRate);
  await save(next);return {schema:'mikoshi.phonetics.training.v1',...result,
   lessons:next.lessons};
 });
 serial=task.catch(()=>{});return task;
}
http.createServer((req,res)=>{
 if(req.method==='GET'&&req.url==='/health')return send(res,200,{app:'mikoshi_phonetics'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,graph());
 if(req.method==='POST'&&req.url==='/invoke'){
  let raw='';req.on('data',d=>{raw+=d;if(raw.length>100000)req.destroy();});
  req.on('end',async()=>{try{
   const b=JSON.parse(raw);send(res,200,{result:await invoke(b)});
  }catch(e){send(res,400,{error:String(e.message).slice(0,120)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8927),'127.0.0.1');

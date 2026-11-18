// Independent local R16 adapter for pinned Mikoshi Python runtime.
import {readFileSync,realpathSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';

let worker=null,port=null,secret='',ready=false,revision=null;
let reason='not_configured';
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const base=resolve(process.env.LOCALAPPDATA||'', 'Adamantium Toolbox','mikoshi');
const under=(root,p)=>{const r=relative(root,p);return r&&!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r);};
const probePort=async()=>new Promise((ok,bad)=>{
 const server=createServer();
 server.once('error',bad).listen(0,'127.0.0.1',()=>{
  const p=server.address().port;server.close(()=>ok(p));
 });
});
const run=(exe,args)=>spawnSync(exe,args,{
 encoding:'utf8',windowsHide:true,timeout:6500,maxBuffer:64*1024
});
function config(){
 const p=join(base,'integration.json');
 const c=JSON.parse(readFileSync(p,'utf8'));
 if(c.schema!=='mikoshi.mas.backend.v1'||!c.pythonExecutable||
    !/^[0-9a-f]{40}$/.test(c.sourceRevision||''))throw Error('invalid_backend_config');
 const root=realpathSync(base),source=realpathSync(c.sourceDir);
 if(!under(root,source))throw Error('source_outside_owner_runtime');
 const git=c.gitExecutable||'git';
 const head=run(git,['-C',source,'rev-parse','HEAD']);
 if(head.status!==0||head.stdout.trim()!==c.sourceRevision)
  throw Error('source_revision_mismatch');
 const dirty=run(git,['-C',source,'status','--porcelain']);
 if(dirty.status!==0||dirty.stdout.trim())throw Error('source_dirty');
 if(run(c.pythonExecutable,['--version']).status!==0)
  throw Error('python_unavailable');
 return {c,source};
}
function childEnvironment(apiToken,apiPort){
 const env={};
 for(const key of ['SystemRoot','WINDIR','ComSpec','PATH','PATHEXT',
  'TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','HOME',
  'LANG','LC_ALL','HOMEDRIVE','HOMEPATH']){
  if(typeof process.env[key]==='string')env[key]=process.env[key];
 }
 return {...env,MIKOSHI_API_TOKEN:apiToken,MIKOSHI_HOST:'127.0.0.1',
  MIKOSHI_PORT:String(apiPort),MIKOSHI_STATE_DIR:join(base,'state'),
  PYTHONDONTWRITEBYTECODE:'1'};
}
export async function boot(){
 if(worker)return;
 try{
  const {c,source}=config();revision=c.sourceRevision;
  mkdirSync(join(base,'state'),{recursive:true});
  port=await probePort();secret=randomBytes(32).toString('hex');
  worker=spawn(c.pythonExecutable,['-B','-m','server.api'],{
   cwd:source,windowsHide:true,stdio:'ignore',
   env:childEnvironment(secret,port)
  });
  worker.on('error',()=>{ready=false;reason='python_spawn_error';});
  worker.on('exit',()=>{ready=false;reason='python_exited';worker=null;});
  for(let i=0;i<40;i++){
   if(!worker)break;
   try{
    const res=await fetch('http://127.0.0.1:'+port+'/api/v1/health',
     {signal:AbortSignal.timeout(300)});
    const json=await res.json();
    if(res.ok&&json.module==='mikoshi.ide'&&json.ready===true){
      ready=true;reason='ok';return;
    }
   }catch{}
   await pause(120);
  }
  reason='startup_timeout';stop();
 }catch(e){reason=String(e.message||'unavailable').slice(0,85);}
}
export function isReady(){return ready&&worker&&worker.exitCode===null;}
export function status(){
 return {schema:'mikoshi.mas.backend.v1',plugin:'running',
  native:isReady()?'online':'offline',reason:isReady()?null:reason,
  revision:revision||null,privileges:'read_only',
  sourcePinned:Boolean(revision),motorControls:false};
}
export async function request(method,path,payload){
 if(!isReady())throw Error('native_unavailable');
 if(!['GET','POST'].includes(method)||!/^\/api\/v1\/[a-z0-9/-]+$/.test(path))
  throw Error('unsupported_native_route');
 const response=await fetch('http://127.0.0.1:'+port+path,{
  method,headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
  body:method==='POST'?JSON.stringify(payload):undefined,
  signal:AbortSignal.timeout(12500)
 });
 const json=await response.json();
 if(!response.ok||json.ok===false)throw Error('native_http_'+response.status);
 return method==='POST'?json.result:json;
}
export function stop(){
 ready=false;
 if(worker){const child=worker;worker=null;try{child.kill();}catch{}}
}

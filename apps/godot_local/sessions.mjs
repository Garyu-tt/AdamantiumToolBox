import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {engine,projectPath} from './config.mjs';
const active=new Map(),limit=Number(process.env.ADA_GODOT_SESSION_LIMIT||1);
const max=Number.isInteger(limit)&&limit>0&&limit<=8?limit:1;
function entry(id){
 if(typeof id!=='string'||!active.has(id))throw Error('session_not_found');
 return active.get(id);
}
function snapshot(id,s){
 return {sessionId:id,status:s.status,projectId:s.projectId,
  pid:s.status==='running'?s.child.pid:null,
  exitCode:s.exitCode,error:s.error||null};
}
export async function start(params){
 if(params?.profile!=='headless')throw Error('unsupported_engine_profile');
 if([...active.values()].filter(s=>['starting','running','stop_requested'].includes(s.status)).length>=max)
  throw Error('session_limit_reached');
 const info=await engine();
 if(!info.configured)throw Error(info.reason);
 const path=await projectPath(params.projectId),id=randomUUID();
 const child=spawn(process.env.ADA_GODOT_EXECUTABLE,['--headless','--path',path],
  {cwd:path,stdio:['ignore','ignore','pipe'],windowsHide:true});
 const value={child,status:'starting',projectId:params.projectId,exitCode:null,error:null};
 active.set(id,value);
 child.on('spawn',()=>{if(value.status==='starting')value.status='running';});
 child.on('error',e=>{value.status='failed';value.error=e.code||'spawn_failed';});
 child.on('exit',(code,signal)=>{
  value.exitCode=code;value.status=value.status==='stop_requested'?'stopped':'exited';
  if(signal)value.error=signal;
 });
 child.stderr?.on('data',data=>{value.error=String(data).slice(-500);});
 return {sessionId:id,status:'starting',projectId:params.projectId,profile:'headless'};
}
export function status(id){return snapshot(id,entry(id));}
export function stop(id){
 const value=entry(id);
 if(!['starting','running'].includes(value.status))return snapshot(id,value);
 value.status='stop_requested';
 if(!value.child.kill('SIGTERM'))value.status='stop_failed';
 return snapshot(id,value);
}
function cleanup(){
 for(const s of active.values())if(['starting','running','stop_requested'].includes(s.status))
  s.child.kill('SIGTERM');
}
process.once('SIGTERM',cleanup);
process.once('SIGINT',cleanup);

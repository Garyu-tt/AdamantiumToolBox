import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
const modes=new Set(['paused','transport_healthy','connecting','backoff','observe_only']);
const reasons=new Set(['unobserved','paused','healthy','probe_failed',
 'ssh_exited','ssh_unhealthy','ssh_starting','ssh_spawn_failed']);
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
export function sanitizeTransport(x,now=Date.now()){
 if(!x||x.schema!=='mas-transport-guardian-status-1')return {mode:'invalid'};
 const updatedAt=stamp(x.updatedAt),age=updatedAt?now-Date.parse(updatedAt):Infinity;
 if(age< -60000)return {mode:'invalid'};
 const mode=age>120000?'stale':modes.has(x.mode)?x.mode:'invalid';
 return {mode,updatedAt,probeOk:x.probeOk===true,ownsSshProcess:x.ownsSshProcess===true,
  failures:Number.isSafeInteger(x.failures)&&x.failures>=0?x.failures:0,
  restarts:Number.isSafeInteger(x.restarts)&&x.restarts>=0?x.restarts:0,
  reason:reasons.has(x.reason)?x.reason:'unobserved',lastGoodUtc:stamp(x.lastGoodUtc),
  nextAttemptUtc:stamp(x.nextAttemptUtc)};
}
export async function currentTransport(home=process.env.LOCALAPPDATA,now=Date.now()){
 if(!home)return {mode:'not_configured'};
 const file=join(home,'Adamantium Toolbox','client-watchdog','telemetry','transport-status.json');
 try{
  const st=await lstat(file);
  if(st.isSymbolicLink()||!st.isFile()||st.size>65536)return {mode:'invalid'};
  return sanitizeTransport(JSON.parse(await readFile(file,'utf8')),now);
 }catch(e){return {mode:e.code==='ENOENT'?'not_configured':'invalid'};}
}

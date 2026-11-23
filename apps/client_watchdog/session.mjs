import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
const modes=new Set(['paused','unknown','agent_present','observe_only','backoff','starting']);
const reasons=new Set(['pause_marker','process_query_failed','agent_detected',
 'agent_missing','launch_requested','launch_failed']);
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
export function sanitizeSession(x,now=Date.now()){
 if(!x||x.schema!=='mas-session-companion-status-1')return {mode:'invalid'};
 const updatedAt=stamp(x.updatedAt),age=updatedAt?now-Date.parse(updatedAt):Infinity;
 if(age< -60000)return {mode:'invalid'};
 return {mode:age>120000?'stale':modes.has(x.mode)?x.mode:'invalid',
  updatedAt,reason:reasons.has(x.reason)?x.reason:'process_query_failed',
  agentCount:Number.isSafeInteger(x.agentCount)&&x.agentCount>=0?Math.min(20,x.agentCount):0,
  failures:Number.isSafeInteger(x.failures)&&x.failures>=0?x.failures:0,
  launches:Number.isSafeInteger(x.launches)&&x.launches>=0?x.launches:0,
  lastGoodUtc:stamp(x.lastGoodUtc),nextAttemptUtc:stamp(x.nextAttemptUtc)};
}
export async function currentSession(home=process.env.LOCALAPPDATA,now=Date.now()){
 if(!home)return {mode:'not_configured'};
 const file=join(home,'Adamantium Toolbox','client-watchdog','telemetry','session-status.json');
 try{
  const st=await lstat(file);
  if(st.isSymbolicLink()||!st.isFile()||st.size>65536)return {mode:'invalid'};
  return sanitizeSession(JSON.parse(await readFile(file,'utf8')),now);
 }catch(e){return {mode:e.code==='ENOENT'?'not_configured':'invalid'};}
}

import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const stateSchema='mas-client-watchdog-state-1';
const reasons=new Set(['healthy','task_stopped','probe_failed','restart_requested',
 'restart_failed','cooldown','unmonitored','probe_unsupported','task_missing']);
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
export function summarize(doc,now=Date.now(),maxAgeMs=120000){
 if(!doc||doc.schema!==stateSchema||!Array.isArray(doc.targets)||doc.targets.length>64)
  return {mode:'invalid',targets:[]};
 const updatedAt=iso(doc.updatedAt),age=updatedAt?now-Date.parse(updatedAt):Infinity;
 if(age< -60000)return {mode:'invalid',targets:[]};
 const mode=age>maxAgeMs?'stale':'fresh';
 const targets=doc.targets.filter(t=>t&&typeof t.id==='string'&&
  /^[a-z][a-z0-9_-]{1,39}$/.test(t.id)).map(t=>({
  id:t.id,taskRunning:t.taskRunning===true,
  probeOk:typeof t.probeOk==='boolean'?t.probeOk:null,
  failures:Number.isSafeInteger(t.failures)&&t.failures>=0?t.failures:0,
  reason:reasons.has(t.reason)?t.reason:'unmonitored',
  lastGoodUtc:iso(t.lastGoodUtc),lastAttemptUtc:iso(t.lastAttemptUtc)
 }));
 return {mode,updatedAt,targets};
}
export async function currentStatus(home=process.env.LOCALAPPDATA,now=Date.now()){
 if(!home)return {mode:'not_configured',targets:[]};
 const path=join(home,'Adamantium Toolbox','client-watchdog','status.json');
 try{
  const file=await lstat(path);
  if(!file.isFile()||file.isSymbolicLink()||file.size>65536)return {mode:'invalid',targets:[]};
  const doc=JSON.parse(await readFile(path,'utf8'));
  const max=Number(process.env.ADA_CLIENT_WATCHDOG_MAX_AGE_MS)||120000;
  return summarize(doc,now,Math.min(Math.max(max,5000),600000));
 }catch(e){return {mode:e.code==='ENOENT'?'not_configured':'invalid',targets:[]};}
}

/** Headless client for the AI-native Semantic IR. No GUI or editor required. */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const home=process.env.LOCALAPPDATA||process.env.HOME;
if(!home)throw Error('No user data path');
const auth=JSON.parse((await readFile(join(home,'Adamantium Toolbox','auth.json'),'utf8')).replace(/^\uFEFF/,''));
const base='http://127.0.0.1:8880';
const cmd=process.argv[2]||'help',arg=process.argv[3];
async function request(path,body){
 const res=await fetch(base+path,{method:body?'POST':'GET',
  headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const data=await res.json();if(!res.ok)throw Error(data.error||'HTTP '+res.status);
 return data;
}
async function jsonFile(path){
 if(!path)throw Error('Provide a JSON plan or intent file');
 return JSON.parse(await readFile(path,'utf8'));
}
async function run(){
 switch(cmd){
  case 'mesh':return request('/api/mesh/status');
  case 'backend':return request('/api/graph');
  case 'semantic':return request('/api/semantic');
  case 'object':return request('/api/object?ref='+encodeURIComponent(arg||''));
  case 'dependencies':return request('/api/codemap/graph');
  case 'context':return request('/api/codemap/context?file='+encodeURIComponent(arg||'')+
   '&sha='+encodeURIComponent(process.argv[4]||''));
  case 'codemap':return request('/api/codemap?level='+encodeURIComponent(arg||0)+
   (process.argv[4]?'&file='+encodeURIComponent(process.argv[4]):''));
  case 'history':return request('/api/changes/history');
  case 'plan':return request('/api/changes/plan',await jsonFile(arg));
  case 'apply':return request('/api/changes/apply',await jsonFile(arg));
  case 'rollback':return request('/api/changes/rollback',{
   change_id:arg,expected_etag:process.argv[4]});
  default:return {commands:['mesh','backend','semantic','object <component://id>',
   'codemap [0|1|2] [file]','dependencies','context <file> <sha256>','history','plan <intent.json>',
   'apply <verified-plan.json>','rollback <change-id> <expected-etag>']};
 }
}
try{console.log(JSON.stringify(await run(),null,2));}
catch(e){console.error('AGENT_ERROR '+e.message);process.exitCode=1;}

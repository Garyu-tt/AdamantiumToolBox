import {readFile,access} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
const path=join(import.meta.dirname,'engine.json');
const valid=(v)=>v?.schema==='mas-browser-engine-1'&&
 Array.isArray(v.registrations)&&Array.isArray(v.commands)&&Array.isArray(v.flags)&&
 v.viewport?.width>=320&&v.viewport?.width<=1920&&
 v.viewport?.height>=200&&v.viewport?.height<=1200&&
 v.maxTabs>=1&&v.maxTabs<=12&&v.startupTimeoutMs>=1000&&v.startupTimeoutMs<=30000&&
 Number.isInteger(v.previewRefreshMs)&&v.previewRefreshMs>=1000&&v.previewRefreshMs<=30000;
export async function config(){
 const value=JSON.parse(await readFile(path,'utf8'));
 if(!valid(value))throw Error('invalid_browser_config');
 return value;
}
async function exists(file){
 if(typeof file!=='string'||!isAbsolute(file))return false;
 try{await access(file);return true;}catch{return false;}
}
export async function engine(configured){
 if(!configured)configured=await config();
 const user=process.env.ADA_BROWSER_EXECUTABLE;
 if(user){
  if(await exists(user))return {path:user,source:'environment'};
  throw Error('browser_engine_override_not_found');
 }
 if(process.platform==='win32'){
  for(const candidate of configured.registrations){
   if(typeof candidate.key!=='string'||!/^HK(?:LM|CU)\\SOFTWARE\\/i.test(candidate.key))continue;
   let output='';
   try{output=execFileSync('reg.exe',['query',candidate.key,'/ve'],{
    encoding:'utf8',timeout:2200,windowsHide:true,stdio:['ignore','pipe','ignore']});}catch{continue;}
   const file=output.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/)?.[1]?.trim();
   if(await exists(file))return {path:file,source:candidate.id};
  }
 }
 for(const name of configured.commands){
  if(!/^[a-z0-9_-]+$/.test(name))continue;
  try{
   const cmd=process.platform==='win32'?'where.exe':'which';
   const output=execFileSync(cmd,[name],{encoding:'utf8',timeout:2000,windowsHide:true});
   const file=output.trim().split(/\r?\n/)[0];
   if(await exists(file))return {path:file,source:name};
  }catch{}
 }
 throw Error('browser_engine_unavailable');
}
export function allowedUrl(url){
 if(typeof url!=='string'||url.length>2048)throw Error('browser_invalid_url');
 let value;try{value=new URL(url);}catch{throw Error('browser_invalid_url');}
 if(!['https:','http:'].includes(value.protocol)||value.username||value.password)
  throw Error('browser_url_denied');
 if(!value.hostname||value.hostname.length>253)throw Error('browser_invalid_hostname');
 return value.href;
}

#!/usr/bin/env node
/** Read-only release receipt audit. No package download, signing or activation. */
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostname} from 'node:os';
import {activeDoc,verifiedPackage} from '../core/plugin_sources.mjs';
import {validateManifest} from '../core/contract.mjs';
import {auditSnapshot,proposePort} from '../standards/lifecycle/delivery-audit.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('LOCALAPPDATA_required');
const runtime=join(home,'Adamantium Toolbox');
const timeout=1500;
async function document(path){return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
async function bundled(){
 const root=join(project,'apps'),apps=[];
 for(const entry of await readdir(root,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.isSymbolicLink())continue;
  let manifest;
  try{manifest=await document(join(root,entry.name,'manifest.json'));}
  catch(e){if(e.code==='ENOENT')continue;throw e;}
  if(!validateManifest(manifest)||manifest.id!==entry.name)throw Error('invalid_bundled_manifest');
  apps.push({id:manifest.id,port:manifest.service.port});
 }
 return apps;
}
async function selected(){
 const rows=[];
 for(const item of (await activeDoc(runtime)).apps){
  try{
   const {manifest}=await verifiedPackage(runtime,item);
   if(!validateManifest(manifest))throw Error('invalid_contract');
   rows.push({id:item.id,hash:item.hash,verified:true,version:manifest.version,
    permissions:manifest.permissions,port:manifest.service.port});
  }catch{
   rows.push({id:item.id,hash:item.hash,verified:false,version:null,
    permissions:[],port:null});
  }
 }
 return rows;
}
async function probe(port){
 const response=await fetch('http://127.0.0.1:'+port+'/health',
  {signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error('health_http_'+response.status);
 return response.json();
}
async function graph(){
 const raw=process.env.ADA_CORE_URL||
  (process.env.ADA_PORT?'http://127.0.0.1:'+process.env.ADA_PORT:null);
 if(!raw)return {ids:null,reason:'core_url_not_discovered'};
 const url=new URL(raw);
 if(url.protocol!=='http:'||!['127.0.0.1','[::1]','localhost'].includes(url.hostname)||
    url.username||url.password)throw Error('core_url_must_be_local');
 const auth=await document(join(runtime,'auth.json'));
 if(typeof auth.token!=='string'||auth.token.length<24)throw Error('core_auth_unavailable');
 try{
  const response=await fetch(new URL('/api/graph',url),
   {headers:{Authorization:'Bearer '+auth.token},signal:AbortSignal.timeout(4000)});
  if(!response.ok)return {ids:null,reason:'core_graph_http_'+response.status};
  const doc=await response.json();
  if(!Array.isArray(doc.nodes))return {ids:null,reason:'invalid_core_graph'};
  return {ids:new Set(doc.nodes.map(x=>x.id).filter(x=>typeof x==='string')),reason:null};
 }catch{return {ids:null,reason:'core_graph_unavailable'};}
}
async function main(){
 const [builtin,plugins,owner,liveGraph]=await Promise.all([
  bundled(),selected(),document(join(runtime,'policy.json')),graph()]);
 if(owner.schema!=='mas-owner-policy-1'||!Array.isArray(owner.capabilities))
  throw Error('owner_policy_invalid');
 const snapshot=await auditSnapshot({bundled:builtin,selected:plugins,
  permissions:owner.capabilities,graphIds:liveGraph.ids,probe});
 let suggestion=null;
 if(process.argv.includes('--propose-port')&&snapshot.blockedCount){
  suggestion=await proposePort(snapshot.portOwners.map(x=>x.port));
 }
 const report={schema:'mas-delivery-audit-1',target:hostname(),
  checkedAt:new Date().toISOString(),selected:plugins.length,
  graph:{checked:liveGraph.ids!==null,reason:liveGraph.reason},
  result:snapshot.results,verifiedCount:snapshot.verifiedCount,
  blockedCount:snapshot.blockedCount,allVerified:snapshot.allVerified,
  ...(suggestion?{portCandidate:suggestion,portCandidateAdvisory:true}:{})};
 console.log(JSON.stringify(report,null,2));
 if(!report.allVerified)process.exitCode=2;
}
main().catch(e=>{console.error('DELIVERY_AUDIT_ERROR '+e.message.slice(0,100));process.exitCode=1;});

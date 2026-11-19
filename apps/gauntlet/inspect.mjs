import {spawnSync} from 'node:child_process';
import {posix} from 'node:path';
import {validateManifest} from '../../core/contract.mjs';
import {bundleHash,validHash,validTask} from './shared.mjs';
const source=/\.(?:mjs|js|py|ts|jsx|tsx|css|html)$/;
const badPath=name=>!(/^[a-zA-Z0-9_.\/-]{1,160}$/.test(name))||
 name.startsWith('/')||name.split('/').includes('..')||name.includes('//');
const fixed=/(?:https?:\/\/(?!www\.w3\.org\/2000\/svg)|[a-zA-Z]:[\\/](?:Program Files|Users|Windows)|\/(?:home|opt|srv|var|etc)\/)/;
const dangerous=/\b(?:eval|new\s+Function)\s*\(/;
function importsOutside(name,text){
 const matches=text.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g);
 for(const m of matches){
  if(m[1].startsWith('node:'))continue;
  if(!m[1].startsWith('.'))return true;
  const target=posix.normalize(posix.join(posix.dirname(name),m[1]));
  if(target==='..'||target.startsWith('../')||target.startsWith('/'))return true;
 }return false;
}
export function inspect(input,active=[]){
 const issues=[],files=input?.files;
 if(!validTask(input?.task_id))issues.push('invalid_task_id');
 if(!validTask(input?.author_id))issues.push('invalid_author_id');
 if(!files||Array.isArray(files)||typeof files!=='object')return {issues:['invalid_files']};
 const entries=Object.entries(files);
 if(entries.length<3||entries.length>80)issues.push('invalid_file_count');
 let total=0;
 for(const [name,text] of entries){
  if(badPath(name)||typeof text!=='string'){issues.push('invalid_file_path_or_type');continue;}
  const bytes=Buffer.byteLength(text);total+=bytes;
  if(bytes>6144||text.split('\n').length>120)issues.push('source_budget:'+name);
  if(source.test(name)){
   if(fixed.test(text))issues.push('hardcoded_environment:'+name);
   if(dangerous.test(text))issues.push('dynamic_execution:'+name);
   if(/\.(?:mjs|js)$/.test(name)){
    if(importsOutside(name,text))issues.push('implicit_dependency:'+name);
    const r=spawnSync(process.execPath,['--check','--input-type=module'],
     {input:text,timeout:2500,encoding:'utf8',maxBuffer:8192});
    if(r.error||r.status!==0)issues.push('syntax:'+name);
   }
  }
 }
 if(total>200000)issues.push('bundle_too_large');
 if(!validHash(input.sha256)||input.sha256!==bundleHash(files))issues.push('checksum_mismatch');
 let manifest;
 try{manifest=JSON.parse(files['manifest.json']);}catch{issues.push('invalid_manifest_json');}
 if(manifest&&!validateManifest(manifest))issues.push('invalid_mas_contract');
 if(manifest&&manifest.id!==input.plugin_id)issues.push('plugin_identity_mismatch');
 if(!files['service.mjs']||!files['view.js'])issues.push('missing_runtime_entry');
 if(manifest)for(const app of active){
  if(app.id!==manifest.id&&app.service?.port===manifest.service?.port)issues.push('port_conflict:'+app.id);
 }
 return {issues:[...new Set(issues)],manifest};
}

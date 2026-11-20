#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Preview adapter only: explicit paths, public bundle, never reads signer key.
// Writes one inert JSON status for visual Node-RED observers.
import {readFile,lstat,stat,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,isAbsolute,join,relative,parse} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {openFactoryAnchor} from './lib/store.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const [cmd,rootArg,bundleFile,anchorPin,sourcePin,ledgerId,outputArg]=process.argv.slice(2);
const digest=x=>createHash('sha256').update(x).digest('hex');
const nested=(a,b)=>{
 const rel=relative(a,b);
 return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));
};
const regular=async(p,max)=>{
 const s=await lstat(p);
 if(!s.isFile()||s.isSymbolicLink()||s.size>max)fail('unsafe_preview_file');
 return readFile(p,'utf8');
};
async function main(){
 if(cmd!=='inspect'||process.argv.length!==9||
  ![rootArg,bundleFile,outputArg].every(x=>
   typeof x==='string'&&isAbsolute(x)))
  fail('explicit_factory_anchor_preview_arguments_required');
 const root=resolve(rootArg),bundlePath=resolve(bundleFile),output=resolve(outputArg);
 if([root,output].some(x=>x===parse(x).root)||
   nested(root,output)||nested(output,root))
  fail('preview_output_must_be_separate');
 if(!(await stat(output)).isDirectory())fail('missing_preview_output');
 const store=openFactoryAnchor({root,anchorPin,sourcePin,ledgerId,allowSigning:false});
 const original=await regular(bundlePath,262144);
 const bundle=JSON.parse(original);
 const [status,app]=await Promise.all([
  store.inspect({bundle}),store.status()
 ]);
 const changed=await regular(bundlePath,262144);
 if(digest(original)!==digest(changed))
  fail('public_evidence_changed_during_inspection');
 const result={
  schema:'adamantium.factory_anchor.preview-status/1',
  status:status.status,
  appId:'factory_anchor',masPackage:'0.1.0',
  app:app,
  verification:status,
  installedInMasCore:false,readOnlyPreview:true,
  privateKeyRead:false,
  permissionsGranted:false,productionPublished:false
 };
 const target=join(output,'factory-anchor-r09-status.json');
 try{
  const info=await lstat(target);
  if(!info.isFile())fail('refuse_status_symlink');
  const previous=JSON.parse(await readFile(target,'utf8'));
  if(previous.schema!==result.schema)fail('refuse_unowned_status_overwrite');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 const temp=join(output,'factory-anchor-'+randomUUID()+'.tmp');
 try{
  await writeFile(temp,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(temp,target);
 }finally{await rm(temp,{force:true});}
 process.stdout.write(JSON.stringify({
  result:status.status,sourceSequence:status.sourceSequence??null,
  anchorSequence:status.anchorSequence??null,
  outputFile:target,productionPermissions:false
 })+'\n');
 if(status.status!=='verified_current')process.exitCode=2;
}
try{await main();}
catch(e){
 process.stderr.write('R09 preview denied: '+(e.code||'operation_failed')+'\n');
 process.exitCode=1;
}

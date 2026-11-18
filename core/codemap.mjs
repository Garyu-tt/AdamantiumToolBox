import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
export function codeMap(level, file,sha){
 return new Promise((accept,reject)=>{
  const args=[resolve(root,'tools/codemap.py'),String(level)];
  if(file)args.push(file);
  if(sha)args.push(sha);
  execFile('python',args,{cwd:root,timeout:8000,maxBuffer:2*1024*1024,windowsHide:true},(err,out)=>{
   let data;try{data=JSON.parse(out);}catch{return reject(Error('codemap_parse_failed'));}
   if(err||data.error)return reject(Error(data.error||'codemap_failed'));
   accept(data);
  });
 });
}

export function codeGraph(mode='graph',file='',sha=''){
 return new Promise((accept,reject)=>{
  const args=[resolve(root,'tools/codemap_graph.py'),mode];
  if(file)args.push(file);
  if(sha)args.push(sha);
  execFile('python',args,{cwd:root,timeout:12000,maxBuffer:4*1024*1024,windowsHide:true},(err,out)=>{
   let data;try{data=JSON.parse(out);}catch{return reject(Error('codegraph_parse_failed'));}
   if(err||data.error)return reject(Error(data.error||'codegraph_failed'));
   accept(data);
  });
 });
}

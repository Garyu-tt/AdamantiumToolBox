import http from 'node:http';
import { mkdir, readdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
const base=resolve(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','workspace');
await mkdir(base,{recursive:true});
const secret=process.env.ADA_INTERNAL_KEY||'';
if(secret.length<24)throw Error('Missing internal key');
const spec={app:'editor',version:1,nodes:[
{id:'editor.view',type:'view',title:'Редактор',icon:'editor',requires:['workspace.read']},
{id:'editor.list',type:'action',title:'Список файлов',requires:['workspace.read']},
{id:'editor.read',type:'action',title:'Чтение',requires:['workspace.read']},
{id:'editor.save',type:'action',title:'Сохранение',requires:['workspace.write']}
],edges:['list','read','save'].map(n=>({from:'editor.view',to:'editor.'+n,type:'uses'}))};
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const hash=s=>createHash('sha256').update(s).digest('hex');
async function pathFor(name,creating=false){
 if(typeof name!=='string'||isAbsolute(name)||name.includes('\0'))throw Error('invalid_path');
 const full=resolve(base,name),rel=relative(base,full);
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('invalid_path');
 const parent=await realpath(creating?dirname(full):full);
 if(parent!==base&&!parent.startsWith(base+sep))throw Error('symlink_outside');
 if(creating)try{if((await lstat(full)).isSymbolicLink())throw Error('symlink_file');}catch(e){if(e.code!=='ENOENT')throw e;}
 return full;
}
async function execute(action,p){
 if(action==='editor.list'){
  const dir=await pathFor(p.path||'.');
  const entries=(await readdir(dir,{withFileTypes:true})).filter(e=>!e.isSymbolicLink()).slice(0,200);
  return entries.map(e=>({name:e.name,type:e.isDirectory()?'dir':'file'}));
 }
 if(action==='editor.read'){
  const file=await pathFor(p.path);const data=await readFile(file);
  if(data.length>524288)throw Error('file_too_large');
  return {content:data.toString('utf8'),etag:hash(data)};
 }
 if(action==='editor.save'){
  if(typeof p.content!=='string'||Buffer.byteLength(p.content)>524288)throw Error('file_too_large');
  const file=await pathFor(p.path,true);
  let before=null;try{before=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(p.etag!==null&&p.etag!==hash(before||'')&&!(before===null&&p.etag===''))throw Error('conflict');
  await writeFile(file,p.content,'utf8');
  return {etag:hash(p.content)};
 }
 throw Error('action_not_found');
}
http.createServer((req,res)=>{
 if(req.url==='/health')return send(res,200,{app:'editor'});
 if(req.headers['x-internal-key']!==secret)return send(res,401,{error:'unauthorized'});
 if(req.method==='GET'&&req.url==='/graph')return send(res,200,spec);
 if(req.method==='POST'&&req.url==='/invoke'){
  let s='';req.on('data',d=>{s+=d;if(s.length>550000)req.destroy();});
  req.on('end',async()=>{try{const b=JSON.parse(s);send(res,200,{result:await execute(b.action,b.params||{})});}catch(e){send(res,400,{error:String(e.message)});}});
  return;
 }
 send(res,404,{error:'not_found'});
}).listen(Number(process.env.APP_PORT||8871),'127.0.0.1');

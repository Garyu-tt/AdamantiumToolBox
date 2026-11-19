import {mkdir,readFile,open} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
const root=process.env.ADA_APP_DATA_DIR||join(process.env.LOCALAPPDATA||homedir(),'Adamantium Toolbox','data','chat_folders');
const file=join(root,'events.jsonl');
let pending=Promise.resolve();
async function load(){try{return (await readFile(file,'utf8')).split('\n').filter(Boolean).map(s=>JSON.parse(s));}
 catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function record(e){await mkdir(root,{recursive:true,mode:0o700});const h=await open(file,'a',0o600);
 try{await h.writeFile(JSON.stringify(e)+'\n');await h.sync();}finally{await h.close();}}
const safe=v=>typeof v==='string'&&/^[\w:-]{1,120}$/.test(v);
const snapshot=events=>{
 const folders=new Map();
 for(const e of events){
  if(e.kind==='folder.created')folders.set(e.id,{id:e.id,name:e.name,items:[]});
  if(e.kind==='folder.linked'&&folders.has(e.folder)){
   const list=folders.get(e.folder).items;
   if(!list.includes(e.ref))list.push(e.ref);
  }
 }
 return [...folders.values()];
};
export async function invoke(action,p={}){
 if(action==='chat_folders.list')return {folders:snapshot(await load())};
 if(!['chat_folders.create','chat_folders.link'].includes(action))throw Error('unknown_action');
 if(!safe(p.opId))throw Error('invalid_op_id');
 const next=pending.then(async()=>{
  const xs=await load(),prior=xs.find(e=>e.opId===p.opId);
  if(prior){if(prior.action!==action)throw Error('op_conflict');return {id:prior.id,replayed:true};}
  const e={id:randomUUID(),opId:p.opId,action,at:new Date().toISOString()};
  if(action==='chat_folders.create'){
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>120)throw Error('invalid_name');
   Object.assign(e,{kind:'folder.created',name:p.name.trim()});
  }else{
   if(!safe(p.folder)||!snapshot(xs).some(f=>f.id===p.folder))throw Error('folder_not_found');
   if(typeof p.ref!=='string'||!/^mas:\/\/[a-z0-9_-]+\/[a-z0-9_-]+\/[\w%.-]{1,200}$/.test(p.ref))throw Error('invalid_ref');
   Object.assign(e,{kind:'folder.linked',folder:p.folder,ref:p.ref});
  }
  await record(e);return {id:e.id,replayed:false};
 });pending=next.catch(()=>{});return next;
}

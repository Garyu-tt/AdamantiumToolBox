import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const root=join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','leonardo');
const file=join(root,'jobs.json'),idPattern=/^[0-9a-f-]{36}$/;
let queue=Promise.resolve();
async function state(){
 try{
  const doc=JSON.parse(await readFile(file,'utf8'));
  if(doc?.schema!=='mas-graphics-jobs-1'||!doc.jobs||
    typeof doc.jobs!=='object'||Array.isArray(doc.jobs))throw Error('bad_job_store');
  return doc;
 }catch(e){if(e.code!=='ENOENT')throw e;return {schema:'mas-graphics-jobs-1',jobs:{}};}
}
function commit(modify){
 const task=queue.then(async()=>{
  const doc=await state(),result=modify(doc);
  await mkdir(root,{recursive:true});
  const tmp=file+'.'+randomUUID()+'.tmp';
  await writeFile(tmp,JSON.stringify(doc));await rename(tmp,file);
  return result;
 });
 queue=task.catch(()=>{});return task;
}
export async function remember({providerId,kind,sourceJobId}){
 if(typeof providerId!=='string'||!providerId||typeof sourceJobId!=='string'||
  !sourceJobId||sourceJobId.length>256)throw Error('invalid_provider_job');
 return commit(doc=>{
  const id=randomUUID();
  doc.jobs[id]={id,providerId,kind,sourceJobId,status:'queued',createdAt:new Date().toISOString()};
  const entries=Object.keys(doc.jobs);
  for(const older of entries.slice(0,Math.max(0,entries.length-256)))delete doc.jobs[older];
  return {id,status:'queued',providerId,kind};
 });
}
export async function findJob(id){
 if(typeof id!=='string'||!idPattern.test(id))throw Error('invalid_job_id');
 const job=(await state()).jobs[id];if(!job)throw Error('job_not_found');
 return job;
}
export async function listJobs(){
 const doc=await state();
 return Object.values(doc.jobs).map(({id,providerId,kind,status,createdAt})=>
  ({id,providerId,kind,status,createdAt}));
}
export async function markJob(id,status){
 if(!['queued','running','completed','failed','cancelled','cancel_requested'].includes(status))
  throw Error('invalid_job_status');
 return commit(doc=>{
  if(!doc.jobs[id])throw Error('job_not_found');
  doc.jobs[id].status=status;doc.jobs[id].updatedAt=new Date().toISOString();
  return {id,status};
 });
}

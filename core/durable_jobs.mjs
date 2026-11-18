import {mkdir,readdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const idPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const schema='mas-durable-job-1';
export class DurableJobs{
 constructor(directory){this.directory=directory;this.pending=Promise.resolve();}
 file(id){if(typeof id!=='string'||!idPattern.test(id))throw Error('invalid_job_id');
  return join(this.directory,id+'.json');}
 async read(id){
  try{const doc=JSON.parse(await readFile(this.file(id),'utf8'));
   if(doc.schema!==schema||doc.jobId!==id)throw Error('corrupt_job');
   return doc;
  }catch(e){if(e.code==='ENOENT')return null;throw e;}
 }
 async list(){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const names=(await readdir(this.directory)).filter(x=>idPattern.test(x.replace(/\.json$/,''))&&x.endsWith('.json'));
  if(names.length>5000)throw Error('job_store_limit');
  const jobs=[];for(const n of names){const job=await this.read(n.slice(0,-5));if(job)jobs.push(job);}
  return jobs.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 save(record){
  const job={...record,schema,updatedAt:new Date().toISOString()};
  const target=this.file(job.jobId),body=JSON.stringify(job);
  if(Buffer.byteLength(body)>262144)throw Error('job_record_too_large');
  const task=this.pending.then(async()=>{
   await mkdir(this.directory,{recursive:true,mode:0o700});
   const temp=join(this.directory,'.'+randomUUID()+'.tmp');
   try{await writeFile(temp,body,{encoding:'utf8',mode:0o600});
    await rename(temp,target);}finally{await rm(temp,{force:true});}
   return job;
  });
  this.pending=task.catch(()=>{});return task;
 }
 async recover(){
  const jobs=await this.list();
  for(const job of jobs)if(['queued','running','cancel_requested'].includes(job.status)){
   job.status='needs_review';job.error='execution_state_unknown_after_restart';
   await this.save(job);
  }
  return jobs;
 }
}

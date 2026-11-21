import {mkdir,readdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createBrain} from './brain.mjs';
const valid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/.test(id);
export class BrainStore{
 constructor(root=process.env.ADA_GENESIS_DIR||
  join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','genesis')){
  this.root=resolve(root);this.queue=Promise.resolve();
 }
 async serial(fn){
  let unlock;const next=new Promise(r=>unlock=r);
  const prior=this.queue;this.queue=prior.then(()=>next,()=>next);
  await prior;try{return await fn();}finally{unlock();}
 }
 file(id){if(!valid(id))throw Error('invalid_brain_id');return join(this.root,'brains',id+'.json');}
 async load(id){return JSON.parse(await readFile(this.file(id),'utf8'));}
 async write(b){
  const path=this.file(b.id),tmp=path+'.'+randomUUID()+'.tmp';
  await mkdir(join(this.root,'brains'),{recursive:true});
  try{await writeFile(tmp,JSON.stringify(b));await rename(tmp,path);}
  finally{await rm(tmp,{force:true}).catch(()=>{});}
 }
 async list(){
  await mkdir(join(this.root,'brains'),{recursive:true});
  const names=(await readdir(join(this.root,'brains'))).filter(n=>n.endsWith('.json')).slice(0,64);
  const items=[];
  for(const name of names){
   const b=await this.load(name.slice(0,-5));
   items.push({id:b.id,species:b.genome.species,neurons:b.neurons.length,ticks:b.ticks});
  }
  return items;
 }
 async create(genome){
  return this.serial(async()=>{
   if((await this.list()).length>=64)throw Error('incubator_full');
   const b=createBrain(genome);await this.write(b);return b;
  });
 }
 async change(id,fn){
  return this.serial(async()=>{
   const b=await this.load(id),result=fn(b);
   await this.write(b);return result;
  });
 }
 async snapshot(id){
  return this.serial(async()=>{
   const b=await this.load(id),snapshotId=randomUUID();
   const dir=join(this.root,'snapshots',id);
   await mkdir(dir,{recursive:true});
   await writeFile(join(dir,snapshotId+'.json'),JSON.stringify(b),{flag:'wx'});
   return {brainId:id,snapshotId,revision:b.revision,ticks:b.ticks};
  });
 }
 async fork(id,snapshotId){
  return this.serial(async()=>{
   let b;
   if(snapshotId){
    if(!valid(id)||!valid(snapshotId))throw Error('invalid_snapshot_id');
    b=JSON.parse(await readFile(join(this.root,'snapshots',id,snapshotId+'.json'),'utf8'));
   }else b=await this.load(id);
   if((await this.list()).length>=64)throw Error('incubator_full');
   const source=b.id;b=structuredClone(b);b.id=randomUUID();
   b.parent={brainId:source,snapshotId:snapshotId||null};
   await this.write(b);return b;
  });
 }
}

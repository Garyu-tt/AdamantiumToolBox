import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const home=join(process.env.LOCALAPPDATA||process.cwd(),'Adamantium Toolbox','leonardo');
const filename=join(home,'icons.json');
const pattern=/^[a-z][a-z0-9_-]{1,39}$/;
let queue=Promise.resolve();
export function validKey(key){if(typeof key!=='string'||!pattern.test(key))throw Error('invalid_icon_key');}
async function state(){
 try{const body=JSON.parse(await readFile(filename,'utf8'));
  if(body.schema!=='mas-leonardo-icons-1'||!body.items||Array.isArray(body.items))throw Error('bad_registry');return body;}
 catch(e){if(e.code==='ENOENT')return {schema:'mas-leonardo-icons-1',items:{}};throw e;}
}
export async function getIcon(key){
 validKey(key);const record=(await state()).items[key];
 if(!record)return {key,found:false};
 return {key,found:true,revision:record.revision,sha256:record.sha256,
  providerId:record.providerId,updatedAt:record.updatedAt,
  dataUri:'data:image/png;base64,'+record.data};
}
export function saveIcon(key,artifact,providerId){
 const pending=queue.then(async()=>{
  validKey(key);
  if(artifact?.mime!=='image/png'||artifact?.encoding!=='base64'||
   typeof artifact.data!=='string'||artifact.data.length>180000||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(artifact.data))throw Error('invalid_icon_artifact');
  const bytes=Buffer.from(artifact.data,'base64');
  if(bytes.length<24||bytes.length>130000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||
   bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)>2048||bytes.readUInt32BE(20)>2048)
   throw Error('invalid_png');
  const doc=await state(),old=doc.items[key];
  const sha256=createHash('sha256').update(bytes).digest('hex');
  doc.items[key]={revision:(old?.revision||0)+1,sha256,providerId,
   updatedAt:new Date().toISOString(),data:bytes.toString('base64')};
  await mkdir(home,{recursive:true});
  const temp=filename+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(doc));await rename(temp,filename);
  return {key,revision:doc.items[key].revision,sha256,providerId};
 });
 queue=pending.catch(()=>{});return pending;
}

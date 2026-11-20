import {readFile,lstat,rm,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export const fail=c=>{throw Object.assign(new Error(c),{code:c});};
export const allowed=/^sha256:[a-f0-9]{64}$/;
export const ident=/^[a-z][a-z0-9_.-]{2,95}$/;
export const required=(value,name)=>{
 if(typeof value!=='string'||!value)fail('missing_'+name);
 return value;
};
export async function regular(path,max){
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>max)
  fail('unsafe_factory_anchor_file');
 if(path.endsWith('anchor-private.pem')&&process.platform!=='win32'&&
   (st.mode&0o077)!==0)fail('private_key_permissions_too_broad');
 return readFile(path,'utf8');
}
export async function atomicJson(root,name,data){
 const tmp=join(root,'.view-'+process.pid+'-'+Date.now()+'.tmp');
 try{
  await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
  await rename(tmp,join(root,name));
 }finally{await rm(tmp,{force:true});}
}

import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
export async function identity(root){
 await mkdir(root,{recursive:true});
 const path=join(root,'identity.json');
 try{return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const keys=generateKeyPairSync('ed25519');
 const data={id:randomUUID(),publicKey:keys.publicKey.export({type:'spki',format:'pem'}),
 privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};
 try{await writeFile(path,JSON.stringify(data),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;
  return JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));}
 return data;
}

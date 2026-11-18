import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {generateKeyPairSync,randomUUID,createPrivateKey,createPublicKey} from 'node:crypto';
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function existingIdentity(root){
 const file=join(root,'identity.json');
 let info;
 try{info=await lstat(file);}
 catch(e){if(e.code==='ENOENT')throw Error('identity_not_provisioned');throw e;}
 if(!info.isFile()||info.isSymbolicLink()||info.size>8192)throw Error('invalid_identity_file');
 let data;try{data=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));}
 catch{throw Error('invalid_identity_file');}
 if(!data||!idPattern.test(data.id)||typeof data.publicKey!=='string'||
  typeof data.privateKey!=='string'||data.publicKey.length>2000||
  data.privateKey.length>4000)throw Error('invalid_identity_file');
 try{
  const publicKey=createPublicKey(data.publicKey),privateKey=createPrivateKey(data.privateKey);
  if(publicKey.asymmetricKeyType!=='ed25519'||privateKey.asymmetricKeyType!=='ed25519'||
   createPublicKey(privateKey).export({type:'spki',format:'pem'})!==
    publicKey.export({type:'spki',format:'pem'}))throw Error('key_mismatch');
 }catch{throw Error('identity_key_mismatch');}
 return data;
}
export async function identity(root){
 await mkdir(root,{recursive:true});
 try{return await existingIdentity(root);}
 catch(e){if(e.message!=='identity_not_provisioned')throw e;}
 const keys=generateKeyPairSync('ed25519'),path=join(root,'identity.json');
 const data={id:randomUUID(),publicKey:keys.publicKey.export({type:'spki',format:'pem'}),
  privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};
 try{await writeFile(path,JSON.stringify(data),{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;}
 return existingIdentity(root);
}

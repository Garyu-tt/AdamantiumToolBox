import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {identity} from '../standards/mesh/identity.mjs';
import {inventory} from '../standards/mesh/store.mjs';
const home=process.env.LOCALAPPDATA;
if(!home)throw Error('LOCALAPPDATA required');
const root=join(home,'Adamantium Toolbox');
const command=process.argv[2]||'status';
const own=await identity(join(root,'mesh'));
async function state(name){
 try{return JSON.parse((await readFile(join(root,'mesh',name),'utf8')).replace(/^\uFEFF/,''));}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
}
let result;
if(command==='public-key')result={node_id:own.id,public_key:own.publicKey};
else if(command==='status')result={node_id:own.id,state:await state('status.json'),packages:(await inventory(root)).length};
else result={commands:['status','public-key']};
console.log(JSON.stringify(result,null,2));

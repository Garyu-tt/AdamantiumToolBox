import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,join,sep,extname,relative,isAbsolute} from 'node:path';
const segment=/^[a-z0-9._-]+$/i;
const allowedScopes=new Set(['internal','manifest']);
const contained=(parent,child)=>{
 const rel=relative(parent,child);
 return rel!==''&&!rel.startsWith('..'+sep)&&rel!=='..'&&!isAbsolute(rel);
};
export async function resolveAsset(root,pathname,appIds=new Set()){
 if(typeof pathname!=='string'||pathname.length>500)throw Error('invalid_asset_path');
 const input=pathname==='/'?'/shell/index.html':
  pathname==='/shell.js'?'/shell/shell.js':
  pathname==='/style.css'?'/shell/style.css':pathname;
 let decoded;try{decoded=decodeURIComponent(input);}catch{throw Error('invalid_asset_path');}
 if(!decoded.startsWith('/')||decoded.includes('\\')||decoded.includes('\0'))throw Error('invalid_asset_path');
 const parts=decoded.slice(1).split('/');
 if(parts.length<2||parts.some(s=>!segment.test(s)||s==='.'||s==='..'))throw Error('invalid_asset_path');
 const config=JSON.parse(await readFile(join(root,'standards','architecture','assets.json'),'utf8'));
 if(config.schema!=='mas-asset-policy-1'||!Array.isArray(config.mounts))throw Error('invalid_asset_policy');
 const mount=config.mounts.find(m=>m.route===parts[0]);
 if(!mount||!allowedScopes.has(mount.scope)||!segment.test(mount.route))throw Error('unmounted_asset');
 const folder=mount.folder.split('/');
 if(folder.some(s=>!segment.test(s)||s==='.'||s==='..')||!Array.isArray(mount.extensions))throw Error('invalid_asset_policy');
 if(!mount.extensions.includes(extname(parts.at(-1))))throw Error('asset_type_denied');
 const app=mount.scope==='manifest';
 if(app&&(parts.length<3||!appIds.has(parts[1])))throw Error('app_not_registered');
 const source=app&&appIds instanceof Map?appIds.get(parts[1]):null;
 const directory=typeof source==='string'?source:source?.directory;
 const revision=typeof source==='object'?source?.hash:null;
 if(revision&&(parts[2]!==revision||parts.length<4))throw Error('stale_asset_revision');
 const base=await realpath(directory||resolve(root,...folder));
 const actual=await realpath(resolve(base,...parts.slice(revision?3:directory?2:1)));
 if((!directory&&!contained(await realpath(root),base))||!contained(base,actual))throw Error('asset_escape');
 if(!(await stat(actual)).isFile())throw Error('asset_not_file');
 return actual;
}

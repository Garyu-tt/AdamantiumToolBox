import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveAsset} from '../core/assets.mjs';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=await mkdtemp(join(tmpdir(),'mas-assets-'));
const add=async(path,body)=>{const target=join(root,path);await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,body);};
const yes=new Set(['editor']);
try{
 await mkdir(join(root,'standards','architecture'),{recursive:true});
 await copyFile(join(project,'standards','architecture','assets.json'),join(root,'standards','architecture','assets.json'));
 await add('shell/index.html','<title>Test</title>');
 await add('shell/shell.js','export const ok=true');
 await add('shell/style.css',':root{}');
 await add('shell/dynamic_module.js','export const added=true');
 await add('apps/editor/view.js','export const view=true');
 await add('apps/other/view.js','export const missing=true');
 await add('icons/next.svg','<svg/>');
 await add('standards/ui/kit.js','export const ui=true');
 assert((await resolveAsset(root,'/',yes)).endsWith(join('shell','index.html')));
 assert((await resolveAsset(root,'/shell.js',yes)).endsWith(join('shell','shell.js')));
 assert((await resolveAsset(root,'/style.css',yes)).endsWith(join('shell','style.css')));
 assert((await resolveAsset(root,'/shell/dynamic_module.js',yes)).endsWith(join('shell','dynamic_module.js')));
 assert((await resolveAsset(root,'/apps/editor/view.js',yes)).endsWith(join('editor','view.js')));
 assert((await resolveAsset(root,'/ui/kit.js',yes)).endsWith(join('ui','kit.js')));
 assert((await resolveAsset(root,'/icons/next.svg',yes)).endsWith(join('icons','next.svg')));
 for(const invalid of ['/apps/other/view.js','/apps/editor/manifest.json',
  '/shell/../standards/architecture/assets.json','/shell/%2e%2e/secret.js',
  '/shell/secret.json','/tools/agent.mjs','/shell/%2f../secret.js']){
  await assert.rejects(resolveAsset(root,invalid,yes),Error,invalid);
 }
 await add('secret.js','export const secret=1');
 try{
  await symlink(join(root,'secret.js'),join(root,'shell','escape.js'));
  await assert.rejects(resolveAsset(root,'/shell/escape.js',yes),/asset_escape/);
 }catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;}
 const config=JSON.parse(await readFile(join(root,'standards','architecture','assets.json')));
 config.mounts.find(x=>x.route==='shell').extensions.push('.svg');
 await add('shell/data.svg','<svg/>');
 await writeFile(join(root,'standards','architecture','assets.json'),JSON.stringify(config));
 assert((await resolveAsset(root,'/shell/data.svg',yes)).endsWith(join('shell','data.svg')));
 console.log('ASSET_POLICY_OK scoped dynamic allowlisted types traversal and symlinks');
}finally{await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:80});}

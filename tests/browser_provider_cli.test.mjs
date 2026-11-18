import {strict as assert} from 'node:assert';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const home=await mkdtemp(join(tmpdir(),'mas-browser-cli-'));
const cli=join(root,'apps','browser','cli.mjs'),key='a'.repeat(64);
function call(...args){
 const r=spawnSync(process.execPath,[cli,...args],{
  env:{...process.env,LOCALAPPDATA:home},encoding:'utf8',timeout:6000});
 return {ok:r.status===0,output:r.stdout,error:r.stderr};
}
try{
 assert(!call('host-enable').ok);
 assert(call('host-enable','--approve').ok);
 const keyFile=join(home,'handoff-key.txt');
 const remote=await readFile(join(home,'Adamantium Toolbox','browser','relay-host-key'),'utf8');
 assert.equal(remote.length,64);
 await writeFile(keyFile,remote);
 assert(!call('client-import',keyFile).ok);
 assert(call('client-import',keyFile,'--approve').ok);
 assert(!call('use-relay','9889').ok);
 assert(call('use-relay','9889','--approve').ok);
 const state=JSON.parse(call('status').output);
 assert.equal(state.mode,'relay');
 assert(state.clientConfigured&&state.hostRelayEnabled);
 assert(!JSON.stringify(state).includes(remote));
 assert(!call('use-relay','1','--approve').ok);
 assert(call('use-local','--approve').ok);
 assert.equal(JSON.parse(call('status').output).mode,'local');
 console.log('BROWSER_PROVIDER_CLI_OK keys withheld explicit approval local tunnel');
}finally{await rm(home,{recursive:true,force:true,maxRetries:4,retryDelay:200});}

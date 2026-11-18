import {fileURLToPath} from 'node:url';
import {ready,execute} from '../shared/execution.mjs';
import {rustToolchain} from './toolchain.mjs';
const runner=fileURLToPath(new URL('./runner.sh',import.meta.url));
async function profile(){
 const toolchain=await rustToolchain();
 return {
  extension:'.sh',timeoutMs:12000,
  mounts:[{source:toolchain,target:'/rust-toolchain'}],
  probe:['/bin/sh','-c',
   '/rust-toolchain/bin/rustc --version >/dev/null 2>&1 && printf FRANK_SANDBOX_OK'],
  readyText:'FRANK_SANDBOX_OK',
  commandFor:(entry,runnerPath)=>['/bin/sh',runnerPath,entry]
 };
}
export async function sandboxReady(){
 try{return await ready(await profile());}catch{return false;}
}
export async function runRust(pkg,digest,action,params){
 return execute(pkg,digest,action,params,runner,await profile());
}

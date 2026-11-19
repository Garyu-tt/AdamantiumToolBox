import {fileURLToPath} from 'node:url';
import {ready,execute} from '../shared/execution.mjs';
import {rustToolchain} from './toolchain.mjs';
const runner=fileURLToPath(new URL('./runner.sh',import.meta.url));
const configuredTimeout=()=>{
 const value=Number(process.env.FRANK_RUST_TIMEOUT_MS||16000);
 if(!Number.isInteger(value)||value<1000||value>90000)throw Error('invalid_rust_timeout');
 return value;
};
async function profile(){
 const {root:toolchain,linker}=await rustToolchain();
 return {
  extension:'.sh',timeoutMs:configuredTimeout(),
  mounts:[{source:toolchain,target:'/rust-toolchain'}],
  probe:['/bin/sh','-c',
   '/rust-toolchain/bin/rustc --version >/dev/null 2>&1 && test -x "$1" && printf FRANK_SANDBOX_OK','--',linker],
  readyText:'FRANK_SANDBOX_OK',
  commandFor:(entry,runnerPath)=>['/bin/sh',runnerPath,entry,linker]
 };
}
export async function sandboxReady(){
 try{return await ready(await profile());}catch{return false;}
}
export async function runRust(pkg,digest,action,params){
 return execute(pkg,digest,action,params,runner,await profile());
}

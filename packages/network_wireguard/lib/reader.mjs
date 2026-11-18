import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {parseWireGuardDump} from './parser.mjs';
const exec=promisify(execFile);
// Only a fixed read command. Never accept a program name, flags or shell from caller arguments.
export async function readWireGuard({runner=exec,binary=process.env.NETWORK_WG_BIN||'wg'}={}){
 try{
  const result=await runner(binary,['show','all','dump'],{shell:false,timeout:4000,maxBuffer:1024*1024,windowsHide:true});
  return {available:true,...parseWireGuardDump(result.stdout),mode:'read_only',enforcement:false};
 }catch(e){
  const reason=e?.code==='ENOENT'?'wg_not_found':
    (e?.code==='EACCES'||e?.code==='EPERM')?'permission_denied':
    e?.message==='invalid_dump'?'invalid_dump':'probe_failed';
  // Deliberately drop stderr, stdout, command, environment and the error object.
  return {available:false,reason,mode:'read_only',enforcement:false};
 }
}

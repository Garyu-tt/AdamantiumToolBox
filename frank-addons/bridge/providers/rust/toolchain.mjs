import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {realpath,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
const exec=promisify(execFile);
/** Only trusted rustc metadata is queried on the host; addon code is never run here. */
export async function rustToolchain(){
 if(process.platform!=='linux')throw Error('linux_namespace_required');
 const bin=process.env.FRANK_RUSTC||'rustc';
 const {stdout}=await exec(bin,['--print','sysroot'],{timeout:3000,
  maxBuffer:8192});
 const location=stdout.trim();
 if(!isAbsolute(location))throw Error('invalid_toolchain_root');
 const root=await realpath(location);
 const {stdout:linkerPath}=await exec('sh',['-c','command -v cc'],{timeout:3000,maxBuffer:8192});
 const linker=await realpath(linkerPath.trim());
 if(root==='/'||!(await stat(join(root,'bin','rustc'))).isFile())
  throw Error('invalid_toolchain');
 if(!(await stat(linker)).isFile())throw Error('missing_system_linker');
 if(!['/usr/','/bin/','/lib/','/lib64/'].some(p=>linker.startsWith(p)))
  throw Error('linker_outside_system_mount');
 return {root,linker};
}

import {fileURLToPath} from 'node:url';
import {ready,execute} from '../shared/execution.mjs';
const runner=fileURLToPath(new URL('./runner.py',import.meta.url));
const profile={
 command:['python3','-I','-S'],
 probe:['python3','-I','-S','-c','print("FRANK_SANDBOX_OK")'],
 readyText:'FRANK_SANDBOX_OK'
};
export const sandboxReady=()=>ready(profile);
export const runPython=(pkg,digest,action,params)=>
 execute(pkg,digest,action,params,runner,profile);

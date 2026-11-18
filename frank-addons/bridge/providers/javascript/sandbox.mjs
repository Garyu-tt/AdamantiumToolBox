import {fileURLToPath} from 'node:url';
import {ready,execute} from '../shared/execution.mjs';
const runner=fileURLToPath(new URL('./runner.mjs',import.meta.url));
const profile={
 executable:process.execPath,
 command:['/frank-executable','--no-addons','--max-old-space-size=64'],
 probe:['/frank-executable','-e','process.stdout.write("FRANK_SANDBOX_OK")'],
 readyText:'FRANK_SANDBOX_OK'
};
export const sandboxReady=()=>ready(profile);
export const runJavaScript=(pkg,digest,action,params)=>
 execute(pkg,digest,action,params,runner,profile);

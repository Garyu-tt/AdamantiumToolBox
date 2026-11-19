// Compatibility launcher for the current Node-only MAS supervisor.
// All graphics generation, rendering and MAS HTTP are performed in C++.
import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
const binary=process.env.MAS_LEONARDO_NATIVE_BIN;
if(!binary||!isAbsolute(binary))throw Error('approved_MAS_LEONARDO_NATIVE_BIN_required');
const child=spawn(binary,[],{stdio:'ignore',windowsHide:true,env:process.env});
child.on('error',error=>{console.error('native_provider_start_failed',error.message);process.exitCode=2;});
child.on('exit',(code,signal)=>{process.exitCode=code??(signal?2:0);});
for(const name of ['SIGINT','SIGTERM'])process.on(name,()=>child.kill(name));

import {pathToFileURL} from 'node:url';
let raw='';
for await(const part of process.stdin){
 raw+=part.toString();
 if(raw.length>65536)throw Error('request_too_large');
}
try{
 const data=JSON.parse(raw);
 const entry=data.entry;
 if(typeof entry!=='string'||!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.mjs$/.test(entry)||
  entry.split('/').some(p=>p==='.'||p==='..'))throw Error('invalid_entry');
 const module=await import(pathToFileURL('/addon/'+entry).href);
 if(typeof module.handle!=='function')throw Error('handler_missing');
 const result=await module.handle(data.action,data.params);
 process.stdout.write(JSON.stringify({result}));
}catch{
 process.stderr.write('frank_javascript_execution_failed\n');
 process.exitCode=1;
}

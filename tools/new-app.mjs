import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateApp} from '../sdk/generate.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2),id=args[0];
const option=name=>{const index=args.indexOf('--'+name);
 return index<0?undefined:args[index+1];};
const port=Number(option('port'));
if(!id||!option('port')){
 console.error('Usage: node tools/new-app.mjs <id> --port <port> [--name <title>] [--icon <id>]');
 process.exit(2);
}
try{
 const result=await generateApp(root,{id,port,name:option('name')||id,
  icon:option('icon')||'studio'});
 console.log(JSON.stringify({draft:result.directory,files:result.files}));
}catch(e){console.error(e.message);process.exitCode=2;}

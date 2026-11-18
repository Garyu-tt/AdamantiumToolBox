import {snapshot,inspect,restore,capabilities} from '../standards/storage/darc.mjs';
const [command,...args]=process.argv.slice(2);
async function run(){
 switch(command){
  case 'capabilities':return capabilities;
  case 'pack':{
   const [destination,...sources]=args;
   return snapshot({destination,sources,profile:process.env.DARC_PROFILE||'balanced'});
  }
  case 'unpack':return restore({archive:args[0],destination:args[1]});
  case 'list':case 'info':case 'verify':
   return inspect({archive:args[0],operation:command});
  default:return {usage:[
   'node tools/archive.mjs capabilities',
   'node tools/archive.mjs pack <archive.darc> <folder-or-file> [...]',
   'node tools/archive.mjs list|info|verify <archive.darc>',
   'node tools/archive.mjs unpack <archive.darc> <new-directory>'
  ],notes:'Optional provider; DEDUPARC_BIN overrides executable discovery.'};
 }
}
try{console.log(JSON.stringify(await run(),null,2));}
catch(e){console.error('DARC_ERROR '+e.message);process.exitCode=1;}

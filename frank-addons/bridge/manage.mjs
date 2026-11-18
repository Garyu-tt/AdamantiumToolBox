import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {frankCatalog} from './catalog.mjs';
import {loadRegistry,saveRegistry,packageDigest} from './approval.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const [command,arg,value]=process.argv.slice(2);
const die=msg=>{throw Error(msg);};
const d=await loadRegistry();
if(command==='status'){console.log(JSON.stringify(d,null,2));process.exit(0);}
const found=await frankCatalog(root);
if(command==='plan'){
 const p=found.find(p=>p.key===arg);if(!p)die('package_not_found');
 console.log(JSON.stringify({key:p.key,digest:await packageDigest(p.directory),
  manifest:p.manifest,adapterRegistered:d.adapters.some(x=>x.capability===p.manifest.adapter),
  note:'Local digest approval; not a signature or sandbox'},null,2));
 process.exit(0);
}
if(!process.argv.includes('--approve'))die('explicit_--approve_required');
if(command==='adapter'){
 if(!/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/.test(arg||''))die('invalid_adapter');
 const port=Number(value);if(!Number.isInteger(port)||port<1024||port>65535)die('invalid_port');
 d.adapters=d.adapters.filter(x=>x.capability!==arg);
 d.adapters.push({capability:arg,port});
}else if(command==='adapter-remove'){
 d.adapters=d.adapters.filter(x=>x.capability!==arg);
}else if(command==='approve'){
 const p=found.find(p=>p.key===arg);if(!p)die('package_not_found');
 if(!d.adapters.some(x=>x.capability===p.manifest.adapter))die('adapter_not_registered');
 if(p.manifest.permissions.length)die('scoped_permissions_not_supported');
 d.packages=d.packages.filter(x=>x.key!==arg);
 d.packages.push({key:arg,digest:await packageDigest(p.directory)});
}else if(command==='disable'){
 d.packages=d.packages.filter(x=>x.key!==arg);
}else die('unknown_command');
await saveRegistry(d);
console.log('FRANK_REGISTRY_UPDATED');

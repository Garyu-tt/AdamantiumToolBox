import {frankCatalog} from '../../catalog.mjs';
import {loadRegistry,packageDigest} from '../../approval.mjs';
export async function authorizedAddon(root,key,action,port,capability,language){
 if(typeof key!=='string'||typeof action!=='string')throw Error('invalid_request');
 const registry=await loadRegistry();
 if(!registry.adapters.some(p=>p.capability===capability&&p.port===port))
  throw Error('adapter_unregistered');
 const approved=registry.packages.find(p=>p.key===key);
 if(!approved)throw Error('addon_not_approved');
 const pkg=(await frankCatalog(root)).find(p=>p.key===key);
 if(!pkg||pkg.language!==language||pkg.manifest.adapter!==capability)
  throw Error('invalid_language_addon');
 if(pkg.manifest.permissions.length)throw Error('scoped_permissions_unsupported');
 if(!(pkg.manifest.actions||[]).some(a=>a.id===action))throw Error('action_not_declared');
 if(await packageDigest(pkg.directory)!==approved.digest)throw Error('package_changed');
 return {pkg,digest:approved.digest};
}

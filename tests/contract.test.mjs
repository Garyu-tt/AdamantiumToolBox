import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateManifest} from '../core/contract.mjs';
import {catalog} from '../core/catalog.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const apps=await catalog(root);
assert(apps.length>=2);
for(const app of apps){
 assert(validateManifest(app));
 assert.equal(app.id,app.id.toLowerCase());
}
const broken={...apps[0],connections:[{from:'bogus.view',to:'other.view',type:'related'}]};
assert(!validateManifest(broken));
console.log('MAS_CONTRACT_OK',apps.map(a=>a.id).join(','));

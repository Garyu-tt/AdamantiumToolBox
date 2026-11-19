import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {validateManifest} from '../core/contract.mjs';
import {status,available,speak} from '../apps/mikoshi_piper/engine.mjs';
const path=new URL('../apps/mikoshi_piper/manifest.json',import.meta.url);
const manifest=JSON.parse(await readFile(path));
assert(validateManifest(manifest));
assert.equal(manifest.id,'mikoshi_piper');
assert.deepEqual(manifest.permissions,['voice.inspect','voice.render']);
const s=status();
assert.equal(s.languageModel,false);
assert.equal(s.provider,'piper');
if(!process.env.MIKOSHI_PIPER_MODEL){
 assert.equal(available(),false,'no downloaded neural voice may be advertised');
 assert.equal(s.modelOwnerApproved,false);
 assert.throws(()=>speak('Привет'),/piper_provider_offline/);
}
console.log('MIKOSHI_PIPER_OK optional fail-closed provider, rights-gated model');

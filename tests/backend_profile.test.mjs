import {strict as assert} from 'node:assert';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalog} from '../core/catalog.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const original=process.env.ADA_RUNTIME_PROFILE;
try{
 process.env.ADA_RUNTIME_PROFILE='full';
 const all=await catalog(root);
 assert(all.length>1);
 assert(all.some(app=>app.ui.mode!=='headless'));
 process.env.ADA_RUNTIME_PROFILE='backend';
 const back=await catalog(root);
 assert(back.length>=1);
 assert(back.some(app=>app.id==='client_watchdog'));
 assert(back.every(app=>app.ui.mode==='headless'));
 assert(!back.some(app=>app.id==='browser'));
 process.env.ADA_RUNTIME_PROFILE='unknown';
 await assert.rejects(catalog(root),/invalid_runtime_profile/);
 console.log('BACKEND_PROFILE_OK only headless MAS apps discovered');
}finally{
 if(original===undefined)delete process.env.ADA_RUNTIME_PROFILE;
 else process.env.ADA_RUNTIME_PROFILE=original;
}

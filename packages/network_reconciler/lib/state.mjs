import {readFile,stat} from 'node:fs/promises';
import {validateSnapshot} from './plan.mjs';
export async function loadSnapshot(filename){
 if(!filename)throw Error('not_configured');
 const s=await stat(filename);if(!s.isFile()||s.size>262144)throw Error('invalid_snapshot_file');
 return validateSnapshot(JSON.parse(await readFile(filename,'utf8')));
}

import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const id = /^[a-z][a-z0-9._-]{1,63}$/;
const gitRepo = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const action = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const keyset = (obj, allowed) => Object.keys(obj).every(k => allowed.includes(k));
const plain = x => !!x && typeof x === 'object' && !Array.isArray(x);
const validRef = x => typeof x === 'string' && x.length < 160 &&
 /^[A-Za-z0-9_./-]+$/.test(x) && !x.startsWith('/') &&
 !x.endsWith('/') && !x.includes('..') && !x.includes('//') &&
 !x.endsWith('.lock') && !x.includes('@{');

export function validateSourceRegistry(registry) {
 const errors = [];
 if (!plain(registry) || registry.schema !== 'mechanicus-source-registry/1' ||
     !Array.isArray(registry.sources) ||
     !keyset(registry, ['schema','sources'])) return ['invalid registry envelope'];
 const ids = new Set();
 for (const [i, item] of registry.sources.entries()) {
  const at = `sources[${i}]`;
  if (!plain(item) || !keyset(item, ['id','exposure','source','installation'])) {
   errors.push(`${at}: invalid keys`); continue;
  }
  if (typeof item.id !== 'string' || !id.test(item.id) || ids.has(item.id)) {
   errors.push(`${at}: invalid or duplicate id`);
  } else ids.add(item.id);
  if (!['public','private','restricted'].includes(item.exposure) ||
      !['manual','on-demand'].includes(item.installation)) errors.push(`${at}: invalid policy`);
  const s = item.source;
  if (!plain(s)) {errors.push(`${at}: missing source`); continue;}
  if (s.kind === 'git') {
   if (item.exposure !== 'public' ||
       !keyset(s, ['kind','repository','ref']) ||
       typeof s.repository !== 'string' || !gitRepo.test(s.repository) ||
       !validRef(s.ref)) errors.push(`${at}: git must be public and pinned to a valid ref`);
  } else if (s.kind === 'capability') {
   if (!keyset(s, ['kind','action']) || typeof s.action !== 'string' ||
       !action.test(s.action)) errors.push(`${at}: invalid capability source`);
  } else errors.push(`${at}: unsupported source kind`);
  if (item.exposure !== 'public' && s.kind !== 'capability') {
   errors.push(`${at}: nonpublic sources require an authorized capability resolver`);
  }
 }
 return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const path = process.argv[2];
 if (!path) {console.error('Usage: node tools/check-repository-sources.mjs registry.json');process.exitCode = 2;}
 else try {
  const registry = JSON.parse(await readFile(path, 'utf8'));
  const errors = validateSourceRegistry(registry);
  if (errors.length) {console.error(errors.join('\n'));process.exitCode = 1;}
  else console.log(`OK: ${registry.sources.length} source records (metadata only)`);
 } catch (err) {console.error(err.message);process.exitCode = 1;}
}

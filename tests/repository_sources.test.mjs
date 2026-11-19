import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSourceRegistry} from '../tools/check-repository-sources.mjs';

const entry = (exposure, source) => ({
 id:'example.module', exposure, source, installation:'manual'
});
const registry = sources => ({schema:'mechanicus-source-registry/1',sources});

test('public sample is well formed', async () => {
 const x = JSON.parse(await readFile('standards/repository-sources/registry.example.json','utf8'));
 assert.deepEqual(validateSourceRegistry(x), []);
});
test('private Git coordinates are not allowed in public registry', () => {
 const x = registry([entry('private',{kind:'git',repository:'org/secret',ref:'main'})]);
 assert.ok(validateSourceRegistry(x).length);
});
test('private capability descriptor contains no repository coordinates', () => {
 assert.deepEqual(validateSourceRegistry(registry([entry('private',{
  kind:'capability', action:'source.resolve'
 })])), []);
});
test('reject duplicate IDs and unrecognized keys', () => {
 const item = entry('public',{kind:'git',repository:'org/repo',ref:'main'});
 assert.ok(validateSourceRegistry(registry([item,item])).length);
 assert.ok(validateSourceRegistry(registry([{...item,secret:'token'}])).length);
});
test('reject suspicious refs and capability names', () => {
 assert.ok(validateSourceRegistry(registry([entry('public',{
  kind:'git',repository:'org/repo',ref:'../../private'
 })])).length);
 assert.ok(validateSourceRegistry(registry([entry('restricted',{
  kind:'capability',action:'source.resolve;evil'
 })])).length);
});

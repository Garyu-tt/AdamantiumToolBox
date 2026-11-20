import test from 'node:test';
import assert from 'node:assert/strict';
import {VerifiedTaskSnapshotBridge} from '../apps/task_snapshot/core_read_bridge.mjs';

test('R08 must re-evaluate attestation freshness after delayed Core graph read', async () => {
 const originalNow = Date.now;
 let clock = 100_000;
 const expectedCore = {
  nodeId: 'core.primary',
  peerFingerprint: 'a'.repeat(64),
  policySha256: 'b'.repeat(64)
 };
 let published = false;
 let invoked = false;
 const session = {
  attest: async () => ({
   ...expectedCore, authenticated: true, identityVerified: true,
   status: 'reachable', canInvoke: true, verifiedAt: 99_000
  }),
  readGraph: async () => {
   // The approved Core read stalls long enough to expire the 30s proof.
   clock = 140_000;
   return {version: 1, nodes: [], edges: []};
  },
  invokeRead: async () => {
   invoked = true;
   return {result: []};
  },
  close: async () => {}
 };
 const publisher = {
  publish: async ({readAction}) => {
   await readAction('task_pool.list', {limit: 200});
   published = true;
   return {status: 'signed-read-only', sequence: 1, envelope: {}};
  }
 };
 try {
  Date.now = () => clock;
  const bridge = new VerifiedTaskSnapshotBridge({
   createSession: async () => session, publisher, expectedCore,
   expectedTaskOwner: 'task_pool'
  });
  let result;
  try { result = await bridge.publish(); } catch { /* fail-closed is valid */ }
  assert.equal(published, false,
   'a proof older than 30 seconds must not authorize a signed snapshot');
  assert.equal(invoked, false,
   'the expired proof must block Core invocation before publishing');
  assert.notEqual(result?.signed, true);
 } finally {
  Date.now = originalNow;
 }
});

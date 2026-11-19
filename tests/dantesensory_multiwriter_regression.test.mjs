import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DurableQueue} from '../apps/dantesensory/queue.mjs';

const event = sequence => ({
  schema: 'dante.sensory.event.v1', source: 'world.mock',
  kind: 'position', sequence, observedAtMs: sequence,
  payload: {position: sequence}
});

// Intentionally RED on #89 head 4cbc113: two open objects share a file
// but serialize only per-instance. Accepted writes must not disappear.
test('P0: two queue owners cannot silently overwrite acknowledged publish', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dante-two-writers-'));
  const path = join(dir, 'queue.json');
  try {
    const a = await new DurableQueue({path, capacity: 4}).open();
    const b = await new DurableQueue({path, capacity: 4}).open();
    const first = await a.publish(event(0));
    assert.equal(first.ok, true);
    const second = await b.publish(event(1));
    // A correct single-writer/fencing implementation can reject B.
    if (!second.ok) {
      assert.match(second.reason || '', /owner|lease|fenc|stale|conflict|version|lock/i);
      return;
    }
    // If B claims success, both events MUST survive durable readback.
    const recovered = await new DurableQueue({path, capacity: 4}).open();
    assert.deepEqual(
      recovered.peek().map(x => x.id).sort(),
      [first.id, second.id].sort(),
      'both accepted events must remain after second writer saves'
    );
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

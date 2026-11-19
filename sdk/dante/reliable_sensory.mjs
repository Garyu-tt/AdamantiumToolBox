// Optional reliable adapter over sensory.event.v1. Never use drain() for Genesis.
// The owner MUST durably checkpoint snapshot() before confirming publish/ack.
import {encodeSensoryEvent} from './sensory_codec.mjs';
import {randomUUID} from 'node:crypto';
export const RELIABLE_SCHEMA = 'dante.sensory.reliable.v1';
export class ReliableSensoryBus {
  #ready = [];
  #leased = new Map();
  #last = new Map();
  #next = 0;
  #stats = {accepted: 0, rejected: 0, acked: 0, replayed: 0};
  constructor({capacity = 64, maxBytes = 65536, maxSources = 256} = {}) {
    if (![capacity, maxSources].every(x => Number.isSafeInteger(x) && x > 0 && x <= 4096))
      throw new RangeError('invalid_capacity');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576)
      throw new RangeError('invalid_max_bytes');
    this.capacity = capacity;
    this.maxBytes = maxBytes;
    this.maxSources = maxSources;
  }
  publish(event) {
    const encoded = encodeSensoryEvent(event, this.maxBytes);
    if (!encoded.ok) return this.#reject(encoded.reason);
    const copy = encoded.event;
    const key = copy.source + '\0' + copy.kind;
    if (copy.sequence <= (this.#last.get(key) ?? -1))
      return this.#reject('non_monotonic_sequence');
    if (!this.#last.has(key) && this.#last.size >= this.maxSources)
      return this.#reject('source_limit');
    if (this.#ready.length + this.#leased.size >= this.capacity)
      return this.#reject('backpressure');
    if (this.#next >= Number.MAX_SAFE_INTEGER) return this.#reject('id_exhausted');
    this.#last.set(key, copy.sequence);
    this.#ready.push({id: ++this.#next, event: copy});
    this.#stats.accepted++;
    return {ok: true};
  }
  #reject(reason) { this.#stats.rejected++; return {ok: false, reason}; }
  claim(limit = 1) {
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > this.capacity)
      throw new RangeError('invalid_limit');
    const out = [];
    while (out.length < limit && this.#ready.length) {
      const entry = this.#ready.shift();
      const receipt = randomUUID();
      this.#leased.set(receipt, entry);
      out.push({receipt, event: structuredClone(entry.event)});
    }
    return out;
  }
  ack(receipt) {
    if (!this.#leased.delete(receipt)) return false;
    this.#stats.acked++;
    return true;
  }
  nack(receipt) {
    const entry = this.#leased.get(receipt);
    if (!entry) return false;
    this.#leased.delete(receipt);
    this.#ready.push(entry);
    this.#ready.sort((a, b) => a.id - b.id);
    return true;
  }
  snapshot() {
    return {schema: RELIABLE_SCHEMA, capacity: this.capacity,
      maxBytes: this.maxBytes, maxSources: this.maxSources, next: this.#next,
      last: [...this.#last], ready: structuredClone(this.#ready),
      leased: structuredClone([...this.#leased.values()])};
  }
  static restore(state) {
    if (!state || state.schema !== RELIABLE_SCHEMA ||
        !Number.isSafeInteger(state.next) || state.next < 0 ||
        !Array.isArray(state.last) || !Array.isArray(state.ready) ||
        !Array.isArray(state.leased)) throw Error('invalid_snapshot');
    const bus = new ReliableSensoryBus(state);
    const entries = [...state.ready, ...state.leased];
    if (entries.length > bus.capacity || state.last.length > bus.maxSources)
      throw Error('invalid_snapshot');
    const ids = new Set();
    const seenKeys = new Set();
    for (const entry of entries) {
      if (!entry || !Number.isSafeInteger(entry.id) || entry.id < 1 ||
          entry.id > state.next || ids.has(entry.id)) throw Error('invalid_snapshot');
      ids.add(entry.id);
      const v = encodeSensoryEvent(entry.event, bus.maxBytes);
      if (!v.ok) throw Error('invalid_snapshot');
    }
    for (const row of state.last) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' ||
          !/^[a-z][a-z0-9_.-]{0,95}\0[a-z][a-z0-9_.-]{0,95}$/.test(row[0]) ||
          !Number.isSafeInteger(row[1]) || row[1] < 0 || seenKeys.has(row[0]))
        throw Error('invalid_snapshot');
      seenKeys.add(row[0]);
      bus.#last.set(row[0], row[1]);
    }
    for (const entry of entries) {
      const key = entry.event.source + '\0' + entry.event.kind;
      if (!bus.#last.has(key) || entry.event.sequence > bus.#last.get(key))
        throw Error('invalid_snapshot');
    }
    bus.#next = state.next;
    bus.#ready = structuredClone(entries).sort((a, b) => a.id - b.id);
    bus.#stats.replayed = state.leased.length;
    return bus;
  }
  status() {
    return {schema: RELIABLE_SCHEMA, capacity: this.capacity,
      queued: this.#ready.length, leased: this.#leased.size,
      sources: this.#last.size, ...this.#stats};
  }
}

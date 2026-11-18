// CPU-only bounded typed transport. This is an optional SDK adapter, not Core.
export const SENSORY_SCHEMA = 'dante.sensory.event.v1';
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,95}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateSensoryEvent(event) {
  return plain(event) && event.schema === SENSORY_SCHEMA &&
    validId(event.source) && validId(event.kind) &&
    Number.isSafeInteger(event.sequence) && event.sequence >= 0 &&
    Number.isFinite(event.observedAtMs) && event.observedAtMs >= 0 &&
    plain(event.payload) &&
    (event.traceId === undefined || validId(event.traceId));
}

export class SensoryBus {
  #queue = [];
  #lastSequence = new Map();
  #metrics = {accepted: 0, rejected: 0, dropped: 0, delivered: 0};
  constructor({capacity = 64, overflow = 'reject'} = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 65536)
      throw new RangeError('invalid_capacity');
    if (!['reject', 'drop-oldest'].includes(overflow)) throw new TypeError('invalid_overflow');
    this.capacity = capacity;
    this.overflow = overflow;
  }
  publish(event) {
    if (!validateSensoryEvent(event)) {
      this.#metrics.rejected++;
      return {ok: false, reason: 'invalid_event'};
    }
    const key = `${event.source}\0${event.kind}`;
    if (event.sequence <= (this.#lastSequence.get(key) ?? -1)) {
      this.#metrics.rejected++;
      return {ok: false, reason: 'non_monotonic_sequence'};
    }
    if (this.#queue.length >= this.capacity && this.overflow === 'reject') {
      this.#metrics.rejected++;
      return {ok: false, reason: 'backpressure'};
    }
    // Clone at ingress so producers cannot mutate already accepted observations.
    let frozen;
    try { frozen = structuredClone(event); } catch {
      this.#metrics.rejected++;
      return {ok: false, reason: 'uncloneable_payload'};
    }
    if (this.#queue.length >= this.capacity) {
      this.#queue.shift();
      this.#metrics.dropped++;
    }
    this.#queue.push(frozen);
    this.#lastSequence.set(key, event.sequence);
    this.#metrics.accepted++;
    return {ok: true};
  }
  drain(limit = this.capacity) {
    if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('invalid_limit');
    const out = this.#queue.splice(0, limit);
    this.#metrics.delivered += out.length;
    return out;
  }
  status() {
    return {schema: SENSORY_SCHEMA, queued: this.#queue.length,
      capacity: this.capacity, overflow: this.overflow, ...this.#metrics};
  }
}

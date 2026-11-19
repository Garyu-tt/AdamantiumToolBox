// JSON-only CPU guard for durable sensory events; no native/platform dependencies.
import {SENSORY_SCHEMA, validateSensoryEvent} from './sensory_bus.mjs';
export function encodeSensoryEvent(event, maxBytes) {
  const fail = reason => ({ok: false, reason});
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576)
    throw new RangeError('invalid_max_bytes');
  // Inspect before serialization to avoid getters/toJSON, cycles, sparse arrays,
  // unsupported prototypes and unchecked recursive structures.
  try {
  const stack = [{value: event, depth: 0}];
  const visited = new WeakSet();
  let nodes = 0;
  let chars = 0;
  while (stack.length) {
    const {value, depth} = stack.pop();
    if (++nodes > 4096 || depth > 32) return fail('invalid_payload');
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return fail('invalid_payload');
      continue;
    }
    if (typeof value === 'string') {
      chars += value.length;
      if (chars > maxBytes) return fail('event_too_large');
      continue;
    }
    if (typeof value !== 'object' || visited.has(value)) return fail('invalid_payload');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null) return fail('invalid_payload');
    visited.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string'))
      return fail('invalid_payload');
    if (Array.isArray(value)) {
      if (value.length > 4096) return fail('invalid_payload');
      if (Object.keys(descriptors).some(key => key !== 'length' &&
          (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)))
        return fail('invalid_payload');
      for (let i = 0; i < value.length; i++) if (!(i in value))
        return fail('invalid_payload');
    }
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (!descriptor.enumerable || !('value' in descriptor)) return fail('invalid_payload');
      chars += key.length;
      if (chars > maxBytes) return fail('event_too_large');
      stack.push({value: descriptor.value, depth: depth + 1});
    }
  }
  if (!validateSensoryEvent(event) || event.schema !== SENSORY_SCHEMA)
    return fail('invalid_event');
  let raw;
  try { raw = JSON.stringify(event); } catch { return fail('invalid_payload'); }
  if (Buffer.byteLength(raw) > maxBytes) return fail('event_too_large');
  return {ok: true, event: JSON.parse(raw)};
  } catch { return fail('invalid_payload'); }
}

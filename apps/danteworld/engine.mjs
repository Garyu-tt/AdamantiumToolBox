// Deterministic CPU-only world fixture. No dependency on Genesis or Core.
export const WORLD_SCHEMA = 'dante.world.v1';
const integer = x => Number.isSafeInteger(x);
const valid = (x, lo, hi) => integer(x) && x >= lo && x <= hi;
export class MockWorld {
  #x;
  #target;
  #tick = 0;
  #limit;
  constructor({start = 0, target = 4, limit = 16} = {}) {
    if (!valid(start, -100000, 100000) || !valid(target, -100000, 100000) ||
        !valid(limit, 1, 100000)) throw new RangeError('invalid_world_config');
    this.#x = start;
    this.#target = target;
    this.#limit = limit;
  }
  observe() {
    return Object.freeze({schema: WORLD_SCHEMA, tick: this.#tick, position: this.#x,
      target: this.#target, error: this.#target - this.#x});
  }
  step(command) {
    if (!command || command.schema !== 'dante.motor.command.v1' ||
        !valid(command.tick, 0, Number.MAX_SAFE_INTEGER) || command.tick !== this.#tick ||
        !valid(command.delta, -1, 1)) throw new TypeError('invalid_motor_command');
    if (this.#tick >= this.#limit) throw new RangeError('tick_limit');
    this.#x = Math.max(-100000, Math.min(100000, this.#x + command.delta));
    this.#tick++;
    return this.observe();
  }
  snapshot() { return {...this.observe(), limit: this.#limit}; }
  static restore(s) {
    if (!s || s.schema !== WORLD_SCHEMA || !valid(s.tick, 0, 100000) ||
        !valid(s.position, -100000, 100000) || !valid(s.target, -100000, 100000) ||
        !valid(s.limit, 1, 100000) || s.tick > s.limit ||
        s.error !== s.target - s.position) throw new TypeError('invalid_world_snapshot');
    const w = new MockWorld({start: s.position, target: s.target, limit: s.limit});
    w.#tick = s.tick;
    return w;
  }
}
export function sensoryFromWorld(observation, source = 'world.mock') {
  if (!observation || observation.schema !== WORLD_SCHEMA ||
      !valid(observation.tick, 0, 100000)) throw new TypeError('invalid_observation');
  if (typeof source !== 'string' || !/^[a-z][a-z0-9_.-]{0,95}$/.test(source))
    throw new TypeError('invalid_source');
  return {schema: 'dante.sensory.event.v1', source, kind: 'position',
    sequence: observation.tick, observedAtMs: observation.tick,
    payload: {position: observation.position, target: observation.target}};
}
export function motorTowardTarget(observation) {
  if (!observation || observation.schema !== WORLD_SCHEMA ||
      !valid(observation.tick, 0, 100000) || !integer(observation.error))
    throw new TypeError('invalid_observation');
  return {schema: 'dante.motor.command.v1', tick: observation.tick,
    delta: Math.sign(observation.error)};
}

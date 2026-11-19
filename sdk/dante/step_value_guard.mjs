// Descriptor-only JSON data boundary; never read caller getters or call toJSON.
export function safeStepValue(value, maxNodes = 8192) {
  const seen = new WeakSet();
  let nodes = 0;
  function visit(v, depth) {
    if (++nodes > maxNodes || depth > 48) throw Error('invalid_step_value');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v !== 'object' || seen.has(v)) throw Error('invalid_step_value');
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null)
      throw Error('invalid_step_value');
    seen.add(v);
    const desc = Object.getOwnPropertyDescriptors(v);
    if (Reflect.ownKeys(desc).some(k => typeof k !== 'string')) throw Error('invalid_step_value');
    if (Array.isArray(v)) {
      if (v.length > maxNodes) throw Error('invalid_step_value');
      const out = [];
      for (let i = 0; i < v.length; i++) {
        const d = desc[String(i)];
        if (!d || !d.enumerable || !('value' in d)) throw Error('invalid_step_value');
        out.push(visit(d.value, depth + 1));
      }
      if (Object.keys(desc).some(k => k !== 'length' &&
          (!/^(0|[1-9]\d*)$/.test(k) || Number(k) >= v.length)))
        throw Error('invalid_step_value');
      seen.delete(v);
      return out;
    }
    const out = Object.create(null);
    for (const [key, d] of Object.entries(desc)) {
      if (!d.enumerable || !('value' in d)) throw Error('invalid_step_value');
      Object.defineProperty(out, key, {value: visit(d.value, depth + 1),
        enumerable: true, writable: true, configurable: true});
    }
    seen.delete(v);
    return out;
  }
  try { return visit(value, 0); } catch { throw Error('invalid_step_value'); }
}

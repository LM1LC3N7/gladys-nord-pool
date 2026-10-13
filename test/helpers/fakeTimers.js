// -----------------------------------------------------------------------------
// Timers the tests fire by hand: nothing runs on its own.
// -----------------------------------------------------------------------------

export function createFakeTimers() {
  const pending = new Map();
  let next = 1;
  const add = (kind) => (fn, ms) => {
    const id = next++;
    pending.set(id, { fn, ms, kind });
    return id;
  };
  const clear = (id) => pending.delete(id);
  return {
    pending,
    setTimeout: add('timeout'),
    setInterval: add('interval'),
    clearTimeout: clear,
    clearInterval: clear,
    /** Run every pending timeout once (intervals stay). */
    async runTimeouts() {
      for (const [id, timer] of [...pending]) {
        if (timer.kind === 'timeout') {
          pending.delete(id);
          await timer.fn();
        }
      }
    },
    /** Run every interval once. */
    async runIntervals() {
      for (const timer of [...pending.values()]) {
        if (timer.kind === 'interval') {
          await timer.fn();
        }
      }
    },
    timeouts() {
      return [...pending.values()].filter((t) => t.kind === 'timeout');
    },
    intervals() {
      return [...pending.values()].filter((t) => t.kind === 'interval');
    },
  };
}

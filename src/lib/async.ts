/** Runs an async mapper over items strictly one at a time, preserving order. */
const sequentially = async <T, U>(items: T[], fn: (item: T) => Promise<U>): Promise<U[]> =>
  items.reduce<Promise<U[]>>(async (accPromise, item) => {
    const acc = await accPromise;
    const result = await fn(item);
    return [...acc, result];
  }, Promise.resolve([]));

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Like `sequentially`, but waits `paceMs` between consecutive calls (never
 * before the first) — for APIs with a requests-per-minute ceiling, where
 * plain sequential calls still burst past the limit.
 */
const pacedSequentially = async <T, U>(items: T[], fn: (item: T) => Promise<U>, paceMs: number): Promise<U[]> =>
  items.reduce<Promise<U[]>>(async (accPromise, item) => {
    const acc = await accPromise;
    if (acc.length > 0) {
      await sleep(paceMs);
    }
    const result = await fn(item);
    return [...acc, result];
  }, Promise.resolve([]));

export { pacedSequentially, sequentially, sleep };

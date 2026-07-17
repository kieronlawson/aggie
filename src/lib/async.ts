/** Runs an async mapper over items strictly one at a time, preserving order. */
const sequentially = async <T, U>(items: T[], fn: (item: T) => Promise<U>): Promise<U[]> =>
  items.reduce<Promise<U[]>>(async (accPromise, item) => {
    const acc = await accPromise;
    const result = await fn(item);
    return [...acc, result];
  }, Promise.resolve([]));

export { sequentially };

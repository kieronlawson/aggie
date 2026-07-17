export const mapSeries = async <A, B>(
  items: readonly A[],
  fn: (item: A) => Promise<B>
): Promise<B[]> =>
  items.reduce<Promise<B[]>>(async (accPromise, item) => {
    const acc = await accPromise;
    const result = await fn(item);
    return [...acc, result];
  }, Promise.resolve([]));

export type Settled<A, B> = { input: A; ok: true; value: B } | { input: A; ok: false; error: string };

const settleOne = async <A, B>(input: A, fn: (item: A) => Promise<B>): Promise<Settled<A, B>> => {
  try {
    const value = await fn(input);
    return { input, ok: true, value };
  } catch (error) {
    return { input, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const mapSeriesSettled = async <A, B>(
  items: readonly A[],
  fn: (item: A) => Promise<B>
): Promise<Settled<A, B>[]> => mapSeries(items, (item) => settleOne(item, fn));

const MILLIS_PER_SECOND = 1000;

export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * MILLIS_PER_SECOND));

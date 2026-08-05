import { afterEach, describe, expect, it, vi } from "vitest";

import { pacedSequentially, sequentially } from "#src/lib/async.ts";

describe("sequentially", () => {
  it("runs tasks one at a time, in order, and returns results", async () => {
    const running: number[] = [];
    const order: number[] = [];
    const results = await sequentially([1, 2, 3], async (n) => {
      running.push(n);
      expect(running).toHaveLength(order.length + 1);
      await new Promise((resolve) => setTimeout(resolve, 5 - n));
      order.push(n);
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("returns empty for empty input", async () => {
    expect(await sequentially([], () => Promise.resolve(1))).toEqual([]);
  });
});

describe("pacedSequentially", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits the pace interval between calls but not before the first", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const promise = pacedSequentially(
      [1, 2, 3],
      (n: number) => {
        calls.push(n);
        return Promise.resolve(n * 2);
      },
      1000
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([1]);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toEqual([1, 2, 3]);
    expect(await promise).toEqual([2, 4, 6]);
  });

  it("returns empty for empty input", async () => {
    expect(await pacedSequentially([], () => Promise.resolve(1), 1000)).toEqual([]);
  });
});

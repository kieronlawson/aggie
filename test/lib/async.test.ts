import { describe, expect, it } from "vitest";

import { sequentially } from "#src/lib/async.ts";

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

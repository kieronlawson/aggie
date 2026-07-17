import { createHash } from "node:crypto";

const ITEM_ID_LENGTH = 32;

export const sha256Hex = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

export const itemIdFromHash = (contentHash: string): string =>
  `item-${contentHash.slice(0, ITEM_ID_LENGTH)}`;

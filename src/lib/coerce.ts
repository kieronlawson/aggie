export type Bag = Record<string, unknown>;

export const str = (bag: Bag, key: string, fallback = ""): string => {
  const value = bag[key];
  return value === undefined || value === null ? fallback : String(value);
};

export const num = (bag: Bag, key: string, fallback = 0): number => {
  const value = bag[key];
  return value === undefined || value === null ? fallback : Number(value);
};

export const strList = (bag: Bag, key: string): string[] => {
  const value = bag[key];
  return Array.isArray(value) ? (value as string[]) : [];
};

export const bool = (bag: Bag, key: string): boolean => bag[key] === true;

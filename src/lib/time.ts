const MILLIS_PER_SECOND = 1000;
export const SECONDS_PER_DAY = 86400;

export const nowSeconds = (): number => Math.floor(Date.now() / MILLIS_PER_SECOND);

export const daysAgoSeconds = (days: number): number => nowSeconds() - days * SECONDS_PER_DAY;

export const parseDateSeconds = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === "") {
    return fallback;
  }
  const millis = Date.parse(value);
  return Number.isNaN(millis) ? fallback : Math.floor(millis / MILLIS_PER_SECOND);
};

export const isoDate = (seconds: number): string =>
  new Date(seconds * MILLIS_PER_SECOND).toISOString().slice(0, 10);

/**
 * Use-by dates.
 *
 * The one idea in this file: **a use-by date is a calendar day, not an
 * instant.** "Use by the 2nd" means the whole of the 2nd — right up until you
 * go to bed — and every bug this file exists to prevent comes from treating it
 * as a timestamp instead.
 *
 * Pure and clock-injectable, like the rest of `lib/`.
 */

/** Local midnight on the day `d` falls on. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Whole days from `now` until `iso`, counted in calendar days. Negative once
 * the day has passed.
 *
 * Both sides are floored to local midnight before subtracting. Diffing the raw
 * timestamps and flooring — the obvious implementation — is wrong twice over:
 * something stamped "use by today" would read as expired a millisecond later,
 * and a `YYYY-MM-DD` value from a date input (which parses as *UTC* midnight)
 * would read as yesterday for everyone west of Greenwich.
 *
 * Rounds rather than floors the day difference, so the 23- and 25-hour days
 * either side of a daylight-saving change still count as one day.
 */
export function daysUntil(iso: string, now: Date): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Infinity;
  return Math.round((startOfDay(then) - startOfDay(now)) / 86_400_000);
}

/**
 * A `YYYY-MM-DD` value from a date input, as an ISO instant on that local day.
 *
 * Noon, deliberately: it is the same calendar day in every timezone on earth
 * and stays that way across a daylight-saving shift, so the date someone picked
 * is the date they get back. `new Date("2026-08-02")` — UTC midnight — is
 * neither.
 */
export function useByIso(value: string): string | undefined {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return undefined;
  const [, year, month, day] = parts;
  return new Date(Number(year), Number(month) - 1, Number(day), 12).toISOString();
}

/** The `YYYY-MM-DD` an instant falls on locally — the inverse of `useByIso`. */
export function useByInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An ISO instant `days` calendar days from now, at local noon. */
export function useByInDays(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

import { describe, expect, it } from "vitest";
import {
  daysUntil,
  useByInDays,
  useByInputValue,
  useByIso,
} from "@/lib/expiry";

/**
 * Everything here is built from local `Date` parts rather than ISO strings, so
 * the suite asserts the same thing in every timezone.
 */
const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h);

describe("daysUntil", () => {
  it("counts whole calendar days forward", () => {
    expect(daysUntil(at(2026, 8, 5).toISOString(), at(2026, 8, 2))).toBe(3);
  });

  it("goes negative once the day has passed", () => {
    expect(daysUntil(at(2026, 7, 31).toISOString(), at(2026, 8, 2))).toBe(-2);
  });

  it("calls today today, all day long", () => {
    // The regression this module exists for. Tapping "today" used to stamp the
    // current instant, which read as expired a millisecond later.
    const morning = at(2026, 8, 2, 0);
    const night = at(2026, 8, 2, 23);
    expect(daysUntil(night.toISOString(), morning)).toBe(0);
    expect(daysUntil(morning.toISOString(), night)).toBe(0);
  });

  it("counts the boundary as a day even one minute across it", () => {
    expect(
      daysUntil(at(2026, 8, 3, 0).toISOString(), at(2026, 8, 2, 23)),
    ).toBe(1);
  });

  it("returns Infinity for an unparseable date rather than throwing", () => {
    expect(daysUntil("not a date", at(2026, 8, 2))).toBe(Infinity);
  });
});

describe("useByIso", () => {
  it("keeps the day you picked, in every timezone", () => {
    // `new Date("2026-08-02")` is UTC midnight, which is the 1st for anyone
    // west of Greenwich. Round-tripping proves we don't do that.
    expect(useByInputValue(useByIso("2026-08-02")!)).toBe("2026-08-02");
  });

  it("reads as today when today is what you picked", () => {
    const now = at(2026, 8, 2, 9);
    expect(daysUntil(useByIso("2026-08-02")!, now)).toBe(0);
  });

  it("has no opinion on a cleared or malformed input", () => {
    expect(useByIso("")).toBeUndefined();
    expect(useByIso("02/08/2026")).toBeUndefined();
    expect(useByIso("2026-8-2")).toBeUndefined();
  });
});

describe("useByInDays", () => {
  it("lands exactly that many days out", () => {
    const now = at(2026, 8, 2, 23);
    expect(daysUntil(useByInDays(0, now), now)).toBe(0);
    expect(daysUntil(useByInDays(2, now), now)).toBe(2);
    expect(daysUntil(useByInDays(14, now), now)).toBe(14);
  });

  it("survives a month boundary", () => {
    const now = at(2026, 8, 30, 20);
    expect(daysUntil(useByInDays(6, now), now)).toBe(6);
  });
});

describe("useByInputValue", () => {
  it("is empty rather than 'NaN-NaN-NaN' for junk", () => {
    expect(useByInputValue("nonsense")).toBe("");
  });
});


import { describe, expect, it } from "vitest";
import {
  cashVariance,
  countAdjustment,
  pctChange,
  presetRange,
  stockStatus,
  todayIn,
} from "./dashboard";

describe("dashboard date ranges", () => {
  it("last 7 days includes today and the 6 days before", () => {
    expect(presetRange("7d", "2026-11-14")).toEqual({
      from: "2026-11-08",
      to: "2026-11-14",
    });
  });

  it("this month starts on the 1st", () => {
    expect(presetRange("month", "2026-11-14")).toEqual({
      from: "2026-11-01",
      to: "2026-11-14",
    });
  });

  it("30 days crosses month boundaries", () => {
    expect(presetRange("30d", "2026-03-05")).toEqual({
      from: "2026-02-04",
      to: "2026-03-05",
    });
  });

  it("today follows Cairo time, not UTC", () => {
    expect(
      todayIn("Africa/Cairo", new Date("2026-11-14T23:30:00Z")),
    ).toBe("2026-11-15");
  });
});

describe("period comparison", () => {
  it("computes growth vs previous period", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
  });

  it("has no comparison when previous period is zero", () => {
    expect(pctChange(100, 0)).toBeNull();
  });

  it("has no comparison when current profit is unavailable", () => {
    expect(pctChange(null, 100)).toBeNull();
  });

  it("has no comparison when previous profit is unavailable", () => {
    expect(pctChange(100, null)).toBeNull();
  });

  it("rejects non-finite profit values", () => {
    expect(pctChange(Number.NaN, 100)).toBeNull();
    expect(pctChange(100, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("supports negative previous values", () => {
    expect(pctChange(50, -100)).toBe(150);
  });
});

describe("stock alerts", () => {
  it("is out of stock at zero or below", () => {
    expect(stockStatus(0, 500)).toBe("out");
    expect(stockStatus(-20, null)).toBe("out");
  });

  it("is low at or under the reorder level", () => {
    expect(stockStatus(500, 500)).toBe("low");
    expect(stockStatus(1400, 1500)).toBe("low");
    expect(stockStatus(1600, 1500)).toBe("ok");
  });

  it("has no alert without a reorder level", () => {
    expect(stockStatus(10, null)).toBe("untracked");
  });

  it("count adjustment moves ledger to the counted quantity", () => {
    expect(countAdjustment(1400, 1250)).toBe(-150);
    expect(countAdjustment(10.5, 12)).toBe(1.5);
  });
});

describe("shift cash", () => {
  it("shortage when counted cash is under opening + cash sales", () => {
    expect(cashVariance(660, 500, 170)).toBe(-10);
  });
});

import { describe, expect, it } from "vitest";
import { cashVariance, countAdjustment, pctChange, presetRange, stockStatus, todayIn } from "./dashboard";

describe("dashboard date ranges", () => {
  it("last 7 days includes today and the 6 days before", () => {
    expect(presetRange("7d", "2026-11-14")).toEqual({ from: "2026-11-08", to: "2026-11-14" });
  });
  it("this month starts on the 1st", () => {
    expect(presetRange("month", "2026-11-14")).toEqual({ from: "2026-11-01", to: "2026-11-14" });
  });
  it("30 days crosses month boundaries", () => {
    expect(presetRange("30d", "2026-03-05")).toEqual({ from: "2026-02-04", to: "2026-03-05" });
  });
  it("today follows Cairo time, not UTC", () => {
    // 23:30 UTC on Nov 14 is already Nov 15 in Cairo (UTC+2)
    expect(todayIn("Africa/Cairo", new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
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
    // opening 500 + cash sales 170 = 670 expected; counted 660 => 10 short
    expect(cashVariance(660, 500, 170)).toBe(-10);
  });
});

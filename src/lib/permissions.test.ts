import { describe, expect, it } from "vitest";
import { hasModule } from "./permissions";

describe("role permissions", () => {
  it("cashier can use the POS but cannot see recipe costs", () => {
    const m = { role: "cashier" as const, modules: null };
    expect(hasModule(m, "pos")).toBe(true);
    expect(hasModule(m, "cost")).toBe(false);
  });

  it("manager cannot open settings by default", () => {
    expect(hasModule({ role: "manager", modules: null }, "settings")).toBe(false);
  });

  it("owner custom modules can grant a barista recipe access", () => {
    expect(hasModule({ role: "barista", modules: ["pos", "recipes"] }, "recipes")).toBe(true);
  });

  it("owner always has every module", () => {
    expect(hasModule({ role: "owner", modules: ["pos"] }, "settings")).toBe(true);
  });
});

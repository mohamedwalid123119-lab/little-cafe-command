import { describe, expect, it } from "vitest";
import { cafeSchema } from "./onboarding";

const ok = { name: "كافيه النيل", phone: "01012345678", address: "شارع التحرير، القاهرة", currency: "EGP" };

describe("create cafe form", () => {
  it("accepts a valid cafe", () => {
    expect(cafeSchema.safeParse(ok).success).toBe(true);
  });
  it("requires a name of at least 2 characters", () => {
    expect(cafeSchema.safeParse({ ...ok, name: " ك " }).success).toBe(false);
  });
  it("allows phone and address to be left empty", () => {
    expect(cafeSchema.safeParse({ ...ok, phone: "", address: "" }).success).toBe(true);
  });
  it("rejects a phone with letters", () => {
    expect(cafeSchema.safeParse({ ...ok, phone: "abc123" }).success).toBe(false);
  });
  it("rejects a currency the database does not accept", () => {
    expect(cafeSchema.safeParse({ ...ok, currency: "GBP" }).success).toBe(false);
  });
});

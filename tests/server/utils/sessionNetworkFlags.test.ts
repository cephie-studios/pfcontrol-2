import { describe, expect, it } from "vitest";

import {
  assertExclusiveSessionNetworkFlags,
  ExclusiveSessionNetworkFlagsError,
  isPostgresCheckViolation,
} from "../../../server/utils/sessionNetworkFlags.js";

describe("sessionNetworkFlags", () => {
  it("allows both false", () => {
    expect(() => assertExclusiveSessionNetworkFlags(false, false)).not.toThrow();
  });

  it("allows only PFATC", () => {
    expect(() => assertExclusiveSessionNetworkFlags(true, false)).not.toThrow();
  });

  it("allows only Advanced ATC", () => {
    expect(() => assertExclusiveSessionNetworkFlags(false, true)).not.toThrow();
  });

  it("rejects both true", () => {
    expect(() => assertExclusiveSessionNetworkFlags(true, true)).toThrow(
      ExclusiveSessionNetworkFlagsError,
    );
  });

  it("detects Postgres check_violation", () => {
    expect(isPostgresCheckViolation({ code: "23514" })).toBe(true);
    expect(isPostgresCheckViolation({ cause: { code: "23514" } })).toBe(true);
    expect(isPostgresCheckViolation({ code: "23505" })).toBe(false);
    expect(isPostgresCheckViolation(new Error("no"))).toBe(false);
  });
});
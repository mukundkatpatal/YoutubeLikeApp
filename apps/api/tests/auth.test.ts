import { describe, expect, it } from "vitest";
import { isParentAllowed } from "../src/auth/google.js";
import { loadEnv } from "../src/config/env.js";

describe("parent allowlist", () => {
  it("allows configured parent emails case-insensitively", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      PARENT_ALLOWLIST_EMAILS: "Parent@Example.com"
    });

    expect(isParentAllowed(env, "parent@example.com")).toBe(true);
    expect(isParentAllowed(env, "someone@example.com")).toBe(false);
  });

  it("allows all parents when the MVP allowlist is empty", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      PARENT_ALLOWLIST_EMAILS: ""
    });

    expect(isParentAllowed(env, "someone@example.com")).toBe(true);
  });
});

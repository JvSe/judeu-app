import { describe, expect, it } from "vitest";

import { isLocalCronEnabled } from "./local";

describe("isLocalCronEnabled", () => {
  it("padrão: ligado só no dev", () => {
    expect(isLocalCronEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isLocalCronEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("LOCAL_CRON manda", () => {
    expect(isLocalCronEnabled({ NODE_ENV: "production", LOCAL_CRON: "true" })).toBe(true);
    expect(isLocalCronEnabled({ NODE_ENV: "development", LOCAL_CRON: "false" })).toBe(false);
  });
});

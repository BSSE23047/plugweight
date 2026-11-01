import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts", "site/test/**/*.test.ts"], testTimeout: 300_000 },
});

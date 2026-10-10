import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      "server-only": `${src}/test/server-only.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // First run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 300_000,
    testTimeout: 30_000,
  },
});

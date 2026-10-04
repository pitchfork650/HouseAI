import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { testDatabaseUrl } from "./tests/test-db";

const url = testDatabaseUrl();

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", globalSetup: ["tests/global-setup.ts"], env: { GEMINI_API_KEY: "", DATABASE_URL: url, DIRECT_URL: url, SWARM_HOST: "mock" } },
});

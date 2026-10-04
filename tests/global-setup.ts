import { execSync } from "node:child_process";
import fs from "node:fs";

/** Tests use their own throwaway SQLite file so they never touch the dev database. */
export default function setup() {
  for (const f of ["prisma/test.db", "prisma/test.db-journal"]) fs.rmSync(f, { force: true });
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "ignore" });
}

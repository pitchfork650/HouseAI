/**
 * Runs in the Vercel build (npm run vercel-build) after the schema is pushed:
 * creates the private storage bucket and seeds the demo data, but only when the
 * database is empty, so redeploys never wipe real changes.
 */
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { ensureBucket } from "../src/lib/storage";

async function main() {
  console.log(`[prepare] storage bucket: ${await ensureBucket()}`);
  const patients = await prisma.patient.count();
  if (patients > 0) {
    console.log(`[prepare] database has ${patients} patients; not seeding`);
    return;
  }
  console.log("[prepare] empty database; seeding demo data");
  const r = spawnSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error("seed failed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

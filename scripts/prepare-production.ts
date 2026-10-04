/**
 * Runs in the Vercel build (npm run vercel-build) after the schema is pushed:
 * creates the private storage bucket and seeds the demo data, but only when the
 * database is empty, so redeploys never wipe real changes.
 */
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { ensureBucket } from "../src/lib/storage";

function run(script: string) {
  const r = spawnSync("npx", ["tsx", script], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`${script} failed`);
}

async function main() {
  const storage = await ensureBucket();
  console.log(`[prepare] storage bucket: ${storage}`);
  const patients = await prisma.patient.count();
  if (patients > 0) console.log(`[prepare] database has ${patients} patients; not seeding`);
  else {
    console.log("[prepare] empty database; seeding demo data");
    run("prisma/seed.ts");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

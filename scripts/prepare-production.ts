/**
 * Runs in the Vercel build (npm run vercel-build) after the schema is pushed:
 * creates the private storage bucket and seeds the demo data, but only when the
 * database is empty, so redeploys never wipe real changes. Then imports the public
 * (commercially licensed) demo X-rays if they're missing, so the landing page has a
 * real image in production too.
 */
import { spawnSync } from "node:child_process";
import { prisma } from "../src/lib/db";
import { ensureBucket } from "../src/lib/storage";

function run(script: string) {
  const r = spawnSync("npx", ["tsx", script], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`${script} failed`);
}

async function main() {
  console.log(`[prepare] storage bucket: ${await ensureBucket()}`);
  const patients = await prisma.patient.count();
  if (patients > 0) console.log(`[prepare] database has ${patients} patients; not seeding`);
  else {
    console.log("[prepare] empty database; seeding demo data");
    run("prisma/seed.ts");
  }
  if (await prisma.patient.findUnique({ where: { id: "CX-01" } })) console.log("[prepare] public demo X-rays present");
  else {
    console.log("[prepare] importing public demo X-rays (Wikimedia Commons)");
    run("scripts/import-commons.ts");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

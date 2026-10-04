import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./test-db";

/** Sync the schema into the test schema, then empty its tables so every run starts clean. */
export default async function setup() {
  const url = testDatabaseUrl();
  execSync("npx prisma db push --skip-generate", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "ignore" });
  const schema = new URL(url).searchParams.get("schema")!;
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = ${schema}`;
    if (rows.length) await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${schema}"."${r.tablename}"`).join(", ")} CASCADE`);
  } finally {
    await prisma.$disconnect();
  }
}

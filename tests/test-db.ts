/**
 * Tests run against their own Postgres schema, never the app's data. TEST_DATABASE_URL
 * must name a non-public schema (e.g. the Supabase session connection with ?schema=test)
 * and differ from DATABASE_URL; global setup empties every table in it before the run.
 */
export function testDatabaseUrl(): string {
  try { process.loadEnvFile(".env"); } catch {}
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL (a Postgres URL with ?schema=test) to run the tests. See .env.example.");
  const schema = new URL(url).searchParams.get("schema");
  if (!schema || schema === "public") throw new Error("TEST_DATABASE_URL must set ?schema= to a dedicated test schema, not public.");
  if (url === process.env.DATABASE_URL || url === process.env.DIRECT_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL and DIRECT_URL.");
  return url;
}

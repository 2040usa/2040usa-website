import { config as loadEnvironment } from "dotenv";

loadEnvironment({ path: ".env.local", quiet: true });

const expectedReference = "bcalocreiqbyufnakrnq";
const required = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_ID"] as const;

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required private environment variable: ${name}`);
}
if (process.env.SUPABASE_PROJECT_ID !== expectedReference || process.env.SUPABASE_EXPECTED_PROJECT_REF !== expectedReference) {
  throw new Error("Refusing Supabase operation: project reference does not match the authorized 2040 USA development project.");
}
const publicUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (publicUrl.hostname !== `${expectedReference}.supabase.co`) throw new Error("Refusing Supabase operation: public URL identifies another project.");
if (!process.env.DATABASE_URL?.includes(expectedReference) || databaseUrl.port !== "5432") throw new Error("Refusing database operation: direct URL identity or port is incorrect.");

console.log(`Authorized Supabase target verified: ${expectedReference}`);

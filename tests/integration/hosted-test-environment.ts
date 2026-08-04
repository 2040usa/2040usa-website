import { config as loadEnvironment } from "dotenv";
import { DEVELOPMENT_PROJECT_REF } from "../../lib/env/validation";

loadEnvironment({ path: [".env.local", ".env.development.local"], quiet: true });

export function getHostedTestEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !publishableKey || !turnstileSiteKey || !databaseUrl) throw new Error("Hosted test environment is incomplete.");
  if (new URL(url).hostname !== `${DEVELOPMENT_PROJECT_REF}.supabase.co` || !databaseUrl.includes(DEVELOPMENT_PROJECT_REF) || new URL(databaseUrl).port !== "5432") {
    throw new Error("Hosted tests refuse to run against an unauthorized project.");
  }
  return { url, publishableKey, turnstileSiteKey, databaseUrl };
}

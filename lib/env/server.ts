import "server-only";
import { validateServerEnvironment } from "@/lib/env/validation";

export function getServerEnvironment() {
  return validateServerEnvironment({
    APP_DEPLOYMENT_ENV: process.env.APP_DEPLOYMENT_ENV,
    NEXT_PUBLIC_APP_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_APP_DEPLOYMENT_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_EXPECTED_PROJECT_REF: process.env.SUPABASE_EXPECTED_PROJECT_REF,
  }, process.env.VERCEL_ENV);
}

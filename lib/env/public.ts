import { validatePublicEnvironment } from "@/lib/env/validation";

export function getPublicEnvironment() {
  return validatePublicEnvironment({
    NEXT_PUBLIC_APP_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_APP_DEPLOYMENT_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
}

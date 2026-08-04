import { z } from "zod";

export const DEVELOPMENT_PROJECT_REF = "bcalocreiqbyufnakrnq";
export const TURNSTILE_ALWAYS_PASS_SITE_KEY = "1x00000000000000000000AA";
export const deploymentModeSchema = z.enum(["development", "test", "production"]);
export type DeploymentMode = z.infer<typeof deploymentModeSchema>;

const publicSchema = z.object({
  NEXT_PUBLIC_APP_DEPLOYMENT_ENV: deploymentModeSchema,
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  APP_DEPLOYMENT_ENV: deploymentModeSchema,
  DATABASE_URL: z.url().refine((value) => new URL(value).protocol === "postgresql:" || new URL(value).protocol === "postgres:", "DATABASE_URL must be PostgreSQL."),
  SUPABASE_EXPECTED_PROJECT_REF: z.string().min(1),
});

export type PublicEnvironment = z.infer<typeof publicSchema>;
export type ServerEnvironment = z.infer<typeof serverSchema>;

function assertEnvironmentBoundaries(environment: PublicEnvironment & { SUPABASE_EXPECTED_PROJECT_REF?: string; DATABASE_URL?: string }, deploymentMode: DeploymentMode) {
  const projectRef = new URL(environment.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  if (deploymentMode === "production") {
    if (projectRef === DEVELOPMENT_PROJECT_REF) throw new Error("Production must not use the 2040 USA development Supabase project.");
    if (environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY === TURNSTILE_ALWAYS_PASS_SITE_KEY) throw new Error("Production must not use Cloudflare Turnstile test credentials.");
  } else if (environment.SUPABASE_EXPECTED_PROJECT_REF) {
    if (environment.SUPABASE_EXPECTED_PROJECT_REF !== DEVELOPMENT_PROJECT_REF || projectRef !== DEVELOPMENT_PROJECT_REF) {
      throw new Error("Supabase development project identity does not match the authorized 2040 USA project.");
    }
    if (environment.DATABASE_URL) {
      const databaseUrl = new URL(environment.DATABASE_URL);
      if (!environment.DATABASE_URL.includes(DEVELOPMENT_PROJECT_REF) || databaseUrl.port !== "5432") {
        throw new Error("DATABASE_URL must identify the authorized project and direct port 5432.");
      }
    }
  }
}

export function validatePublicEnvironment(input: unknown) {
  const environment = publicSchema.parse(input);
  assertEnvironmentBoundaries(environment, environment.NEXT_PUBLIC_APP_DEPLOYMENT_ENV);
  return environment;
}

export function validateServerEnvironment(input: unknown, trustedHostingEnvironment?: string) {
  const environment = serverSchema.parse(input);
  if (environment.APP_DEPLOYMENT_ENV !== environment.NEXT_PUBLIC_APP_DEPLOYMENT_ENV) {
    throw new Error("Public and server deployment modes must match.");
  }
  const deploymentMode = trustedHostingEnvironment === "production" ? "production" : environment.APP_DEPLOYMENT_ENV;
  assertEnvironmentBoundaries(environment, deploymentMode);
  return environment;
}

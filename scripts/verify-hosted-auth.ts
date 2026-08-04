import { config as loadEnvironment } from "dotenv";
import { DEVELOPMENT_PROJECT_REF } from "../lib/env/validation";

loadEnvironment({ path: ".env.local", quiet: true });

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken || process.env.SUPABASE_PROJECT_ID !== DEVELOPMENT_PROJECT_REF || process.env.SUPABASE_EXPECTED_PROJECT_REF !== DEVELOPMENT_PROJECT_REF) {
  throw new Error("Refusing hosted Auth operation: authorized project identity or access token is missing.");
}
const endpoint = `https://api.supabase.com/v1/projects/${DEVELOPMENT_PROJECT_REF}/config/auth`;
const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

async function readConfiguration() {
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Hosted Auth configuration read failed with HTTP ${response.status}.`);
  return await response.json() as { external_anonymous_users_enabled?: boolean; security_captcha_enabled?: boolean; security_captcha_provider?: string };
}

let configuration = await readConfiguration();
if (process.argv.includes("--apply-anonymous") && configuration.external_anonymous_users_enabled !== true) {
  const response = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ external_anonymous_users_enabled: true }) });
  if (!response.ok) throw new Error(`Hosted Auth configuration update failed with HTTP ${response.status}.`);
  configuration = await readConfiguration();
}

console.log(`Authorized Auth project: ${DEVELOPMENT_PROJECT_REF}`);
console.log(`Anonymous sign-ins enabled: ${configuration.external_anonymous_users_enabled === true}`);
console.log(`CAPTCHA enabled: ${configuration.security_captcha_enabled === true}`);
console.log(`CAPTCHA provider: ${configuration.security_captcha_provider ?? "not configured"}`);

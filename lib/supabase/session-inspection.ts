type SessionInspectionClient = {
  auth: {
    getSession: () => Promise<{ data: { session: unknown | null }; error: unknown | null }>;
    getClaims: () => Promise<{ data: { claims?: { sub?: unknown } } | null; error: unknown | null }>;
  };
};

export type BrowserSessionInspection = { kind: "absent" } | { kind: "present" } | { kind: "error"; message: string };

export async function inspectBrowserSession(client: SessionInspectionClient): Promise<BrowserSessionInspection> {
  try {
    const session = await client.auth.getSession();
    if (session.error) return { kind: "error", message: "The anonymous session could not be inspected." };
    if (!session.data.session) return { kind: "absent" };
    const claims = await client.auth.getClaims();
    if (claims.error || !claims.data?.claims?.sub) return { kind: "error", message: "The existing anonymous session could not be verified. Retry shortly." };
    return { kind: "present" };
  } catch {
    return { kind: "error", message: "The anonymous session could not be checked." };
  }
}

import { verifiedOwnerIdSchema } from "@/lib/http/security";

type OwnerVerificationClient = {
  auth: {
    getSession: () => Promise<{ data: { session: unknown | null }; error: unknown | null }>;
    getClaims: () => Promise<{ data: { claims?: { sub?: unknown } } | null; error: unknown | null }>;
  };
};

export type VerifiedOwner =
  | { kind: "verified"; ownerUserId: string }
  | { kind: "absent" }
  | { kind: "error" };

export async function verifyOwnerWithClient(
  createClient: () => Promise<OwnerVerificationClient>,
): Promise<VerifiedOwner> {
  try {
    const supabase = await createClient();
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) return { kind: "error" };
    if (!sessionResult.data.session) return { kind: "absent" };

    const claimsResult = await supabase.auth.getClaims();
    if (claimsResult.error) return { kind: "error" };
    const ownerId = verifiedOwnerIdSchema.safeParse(claimsResult.data?.claims?.sub);
    return ownerId.success
      ? { kind: "verified", ownerUserId: ownerId.data }
      : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

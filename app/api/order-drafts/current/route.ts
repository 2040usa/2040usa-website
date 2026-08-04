import { findActiveDraftForOwner } from "@/lib/database/order-draft-repository";
import { apiError, getVerifiedOwner, privateJson } from "@/lib/api/order-drafts";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await getVerifiedOwner();
  if (owner.kind === "absent") return privateJson({ draft: null });
  if (owner.kind === "error") return apiError(503, "AUTH_VERIFICATION_FAILED", "The anonymous session could not be verified. Retry shortly.");
  try {
    const draft = await findActiveDraftForOwner(owner.ownerUserId);
    return privateJson({ draft });
  } catch {
    return apiError(500, "SERVER_ERROR", "The stored draft could not be loaded.");
  }
}

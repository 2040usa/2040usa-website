import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyOwnerWithClient, type VerifiedOwner } from "@/lib/supabase/owner-verification";

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_VERIFICATION_FAILED"
  | "INVALID_REQUEST"
  | "INVALID_JSON"
  | "BODY_TOO_LARGE"
  | "ORIGIN_MISMATCH"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "ARTWORK_NOT_READY"
  | "ARTWORK_QUOTA_EXCEEDED"
  | "ARTWORK_ROUTE_MISMATCH"
  | "ARTWORK_RECOVERY_AMBIGUOUS"
  | "ARTWORK_RECOVERY_EXPIRED"
  | "ARTWORK_CLEANUP_INCOMPLETE"
  | "IDEMPOTENCY_CONFLICT"
  | "UPLOAD_VERIFICATION_FAILED"
  | "STORAGE_OPERATION_FAILED"
  | "SERVER_ERROR";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" };

export function privateJson(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...privateHeaders, ...init.headers } });
}

export function apiError(status: number, code: ApiErrorCode, message: string) {
  return privateJson({ error: { code, message } }, { status });
}

export async function getVerifiedOwner(): Promise<VerifiedOwner> {
  return verifyOwnerWithClient(createSupabaseServerClient);
}

export function ownerErrorResponse(owner: Exclude<VerifiedOwner, { kind: "verified" }>) {
  return owner.kind === "absent"
    ? apiError(401, "AUTH_REQUIRED", "A verified anonymous session is required.")
    : apiError(503, "AUTH_VERIFICATION_FAILED", "The anonymous session could not be verified. Retry shortly.");
}

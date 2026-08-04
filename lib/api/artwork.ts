import "server-only";
import { ZodError } from "zod";
import { apiError } from "@/lib/api/order-drafts";
import { ArtworkConflictError, ArtworkIdempotencyConflictError, ArtworkNotFoundError, ArtworkQuotaError, ArtworkRecoveryError, ArtworkRouteError } from "@/lib/database/artwork-repository";
import { RequestBodyError } from "@/lib/http/security";

export function artworkApiFailure(error: unknown) {
  if (error instanceof ArtworkConflictError) return apiError(409, "VERSION_CONFLICT", "A newer artwork or draft version exists.");
  if (error instanceof ArtworkIdempotencyConflictError) return apiError(409, "IDEMPOTENCY_CONFLICT", "That reservation request identifier was already used for different artwork.");
  if (error instanceof ArtworkRecoveryError) return apiError(409, "ARTWORK_RECOVERY_AMBIGUOUS", "The selected file does not match the chosen recovery record.");
  if (error instanceof ArtworkNotFoundError) return apiError(404, "NOT_FOUND", "Artwork not found.");
  if (error instanceof ArtworkQuotaError) return apiError(409, "ARTWORK_QUOTA_EXCEEDED", "This draft has reached its artwork upload limit.");
  if (error instanceof ArtworkRouteError) return apiError(409, "ARTWORK_ROUTE_MISMATCH", "The artwork does not match the confirmed starting point.");
  if (error instanceof RequestBodyError) return apiError(error.code === "BODY_TOO_LARGE" ? 413 : 400, error.code, "The request body is not valid.");
  if (error instanceof ZodError) return apiError(400, "INVALID_REQUEST", "The artwork request is invalid.");
  return apiError(500, "SERVER_ERROR", "The artwork request could not be completed.");
}

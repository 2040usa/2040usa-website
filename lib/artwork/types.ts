import type { OrderRoute } from "@/lib/order-draft/types";

export type ArtworkExtension = "png" | "jpg" | "jpeg" | "webp" | "pdf" | "ai" | "psd";
export type ArtworkMimeType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf" | "application/postscript" | "image/vnd.adobe.photoshop";
export type ArtworkPurpose = "gang-sheet-file" | "individual-design" | "size-based-design" | "apparel-artwork-reference";
export type ArtworkStatus = "pending" | "uploaded" | "failed" | "deleting";
export type ArtworkFailureCode = "upload_failed" | "upload_expired" | "object_missing" | "size_mismatch" | "mime_mismatch" | "verification_failed" | "deletion_failed";

export type OrderRouteArtworkPolicy = {
  purpose: ArtworkPurpose;
  minimumUploaded: number;
  maximumActive: number;
};

export type CanonicalArtworkRecord = {
  id: string;
  draftId: string;
  route: OrderRoute;
  purpose: ArtworkPurpose;
  status: ArtworkStatus;
  originalName: string;
  extension: ArtworkExtension;
  mimeType: ArtworkMimeType;
  declaredSizeBytes: number;
  clientLastModified: number | null;
  clientFingerprint: string;
  failureCode: ArtworkFailureCode | null;
  attemptExpiresAt: string;
  uploadedAt: string | null;
  verifiedSizeBytes: number | null;
  verifiedMimeType: ArtworkMimeType | null;
  version: number;
  replacementForId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArtworkReadiness = {
  ready: boolean;
  uploadedCount: number;
  activeCount: number;
  totalDeclaredBytes: number;
  totalVerifiedBytes: number;
};

export type ArtworkUploadReservation = {
  artwork: CanonicalArtworkRecord;
  upload: {
    artworkId: string;
    bucketName: "customer-artwork";
    objectName: string;
    contentType: ArtworkMimeType;
    cacheControl: "3600";
  } | null;
};

export type ArtworkApiSnapshot = {
  artwork: CanonicalArtworkRecord[];
  readiness: ArtworkReadiness;
};

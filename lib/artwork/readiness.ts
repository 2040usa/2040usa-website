import { ARTWORK_POLICY_BY_ROUTE } from "@/lib/artwork/constants";
import type { ArtworkReadiness, CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { OrderRoute } from "@/lib/order-draft/types";

export function calculateArtworkReadiness(route: OrderRoute | null, records: readonly CanonicalArtworkRecord[]): ArtworkReadiness {
  if (!route) return { ready: false, uploadedCount: 0, activeCount: 0, totalDeclaredBytes: 0, totalVerifiedBytes: 0 };
  const policy = ARTWORK_POLICY_BY_ROUTE[route];
  const compatible = records.filter((record) => record.route === route && record.purpose === policy.purpose);
  const active = compatible.filter((record) => record.status !== "deleting");
  const uploaded = active.filter((record) => record.status === "uploaded");
  const ready = uploaded.length >= policy.minimumUploaded;
  return {
    ready,
    uploadedCount: uploaded.length,
    activeCount: active.length,
    totalDeclaredBytes: active.reduce((total, record) => total + record.declaredSizeBytes, 0),
    totalVerifiedBytes: uploaded.reduce((total, record) => total + (record.verifiedSizeBytes ?? 0), 0),
  };
}

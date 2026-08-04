export async function createArtworkClientFingerprint(input: {
  draftId: string;
  originalName: string;
  declaredSizeBytes: number;
  mimeType: string;
  clientLastModified: number | null;
}) {
  const source = ["fp1", input.draftId, input.originalName, input.declaredSizeBytes, input.mimeType, input.clientLastModified ?? "none"].join("\u001f");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `fp1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

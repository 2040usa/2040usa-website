const TRANSPORT_ID_PREFIX = "artwork-reservation";
const STAGING_ID_PREFIX = "artwork-staging";

export function createArtworkTransportFileId(artworkId: string) {
  return `${TRANSPORT_ID_PREFIX}-${artworkId}`;
}

export function createArtworkStagingFileId(stagingId: string) {
  return `${STAGING_ID_PREFIX}-${stagingId}`;
}

export function createArtworkTusFingerprint(artworkId: string, endpoint: string) {
  return ["tus", createArtworkTransportFileId(artworkId), endpoint].join("-");
}

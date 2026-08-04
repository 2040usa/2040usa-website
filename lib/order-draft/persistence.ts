export type PersistenceResponseKind = "success" | "conflict" | "retryable-error";

export function persistenceResponseKind(status: number): PersistenceResponseKind {
  if (status >= 200 && status < 300) return "success";
  if (status === 409) return "conflict";
  return "retryable-error";
}

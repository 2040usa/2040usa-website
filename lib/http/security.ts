import { z } from "zod";

export const MAX_DRAFT_BODY_BYTES = 64 * 1024;

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const requestHost = request.headers.get("host") ?? requestUrl.host;
    const requestProtocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
    return originUrl.host === requestHost && originUrl.protocol === `${requestProtocol}:`;
  } catch {
    return false;
  }
}

export async function readJsonBody(request: Request, maxBytes = MAX_DRAFT_BODY_BYTES): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) throw new RequestBodyError("BODY_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RequestBodyError("BODY_TOO_LARGE");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError("INVALID_JSON");
  }
}

export class RequestBodyError extends Error {
  constructor(public readonly code: "BODY_TOO_LARGE" | "INVALID_JSON") {
    super(code);
  }
}

export const verifiedOwnerIdSchema = z.uuid();

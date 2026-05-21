import "server-only";

import { createHash } from "node:crypto";

/**
 * Stable fingerprint for duplicate detection (same technician + template + pricing shape).
 */
export function computeServiceInstancePayloadFingerprint(params: {
  semenServiceTemplateId: string;
  aiTechnicianProfileId: string;
  deploymentBranch: string | null;
  payload: unknown;
}): string {
  const normalized = stableStringify({
    t: params.semenServiceTemplateId,
    p: params.aiTechnicianProfileId,
    b: params.deploymentBranch ?? "main",
    payload: normalizePayloadForFingerprint(params.payload),
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function normalizePayloadForFingerprint(payload: unknown): unknown {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const o = payload as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = o[k];
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => stableStringify(x)).join(",")}]`;
  }
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",")}}`;
}

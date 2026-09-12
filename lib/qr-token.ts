import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value || value.length < 32) {
    throw new Error("QR_SIGNING_SECRET must be configured with at least 32 characters");
  }
  return value;
}

export function signQrPayload(checkId: string) {
  const payload = Buffer.from(JSON.stringify({ checkId, v: 1 }), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyQrToken(token: string): { checkId: string; v: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

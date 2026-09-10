import { createHmac, timingSafeEqual } from "crypto";

// Meta signs webhook bodies with the App Secret as
// `X-Hub-Signature-256: sha256=<hex hmac>`.
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const [scheme, providedHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const provided = Buffer.from(providedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

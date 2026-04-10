import crypto from "node:crypto";

import {
  getControlPlaneEncryptionSecret,
  getControlPlaneOAuthStateSecret,
} from "./env";

export function encryptControlPlaneSecret(plaintext: string) {
  const iv = crypto.randomBytes(12);
  const key = getControlPlaneEncryptionSecret();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptControlPlaneSecret(ciphertext: string) {
  const [ivPart, tagPart, bodyPart] = ciphertext.split(".");

  if (!ivPart || !tagPart || !bodyPart) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getControlPlaneEncryptionSecret(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(bodyPart, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function signOAuthState(payload: Record<string, string>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getControlPlaneOAuthStateSecret())
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

export function verifyOAuthState<T extends Record<string, string>>(
  encodedState: string,
) {
  const [body, signature] = encodedState.split(".");

  if (!body || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getControlPlaneOAuthStateSecret())
    .update(body)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

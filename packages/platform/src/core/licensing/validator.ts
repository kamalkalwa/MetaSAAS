/**
 * License Key Validator
 *
 * Validates JWT license keys using RSA-SHA256 signature verification.
 *
 * Architecture:
 *   - License keys are JWTs signed with our PRIVATE RSA key (kept secret)
 *   - This module verifies using the PUBLIC key (embedded in source)
 *   - Users can decode the JWT (it's base64) but CANNOT forge valid signatures
 *   - No phone-home, no remote validation — fully offline
 *
 * License key payload structure:
 *   {
 *     sub: "customer_123",        // Customer identifier
 *     features: ["ai.chat", ...], // Enabled feature IDs
 *     iat: 1709000000,            // Issued at (Unix timestamp)
 *     exp: 1740000000             // Expires at (Unix timestamp)
 *   }
 */

import { createVerify, createPublicKey, type KeyObject } from "node:crypto";
import type { Feature } from "./features.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LicensePayload {
  /** Customer identifier */
  sub: string;
  /** Enabled feature IDs */
  features: string[];
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expires at (Unix timestamp) */
  exp: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  payload: LicensePayload | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Public Key
// ---------------------------------------------------------------------------

/**
 * RSA public key for license verification.
 * This is safe to embed in source — it can only VERIFY, not SIGN.
 * The corresponding private key is held by us and never distributed.
 */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2KoKcPS7+hkerl6EnJXo
nd/5UMyhuVfYFg+reOZQfViOAPyrksdbfmFhyt12mLOI8Jt1FQCPWprpcAVViAjw
4wr4+VBGUyJoOzSe59IOW4U1ueqdlQZi5xr8jVoaTGtvs5xxZFHW14u1wVu8D+94
b9hT5IiVP0z2mPFM/MQbz0OutFgULHr/tBlEzM6BIjGb0+9iP1cHnHKy9k6vLxnt
QUcn8kBDih4zcfoyPirJX4hqFSvx8OPbqrWPbbEv/nkftNCk7YM7mnU+HNK+t9bq
RDowVMmoJ5jck2Mctn/w4KAC87+K0zEfCotIVuOFo+q24/SohIrU6aXI2nKbURec
AwIDAQAB
-----END PUBLIC KEY-----`;

let publicKey: KeyObject | null = null;

function getPublicKey(): KeyObject {
  if (!publicKey) {
    publicKey = createPublicKey(PUBLIC_KEY_PEM);
  }
  return publicKey;
}

// ---------------------------------------------------------------------------
// JWT Verification
// ---------------------------------------------------------------------------

/**
 * Base64url decode (JWT uses base64url, not standard base64).
 */
function base64urlDecode(input: string): Buffer {
  // Replace URL-safe chars and pad
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * Validates a JWT license key.
 *
 * Steps:
 *   1. Split into header.payload.signature
 *   2. Verify RSA-SHA256 signature against embedded public key
 *   3. Decode and parse payload
 *   4. Check expiry
 *   5. Validate payload structure
 *
 * Returns { valid: true, payload } on success.
 * Returns { valid: false, error } on any failure.
 * NEVER throws — all errors are caught and returned.
 */
export function validateLicenseKey(token: string): LicenseValidationResult {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, payload: null, error: "Invalid token format" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const data = `${headerB64}.${payloadB64}`;
    const signature = base64urlDecode(signatureB64);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(data);

    if (!verifier.verify(getPublicKey(), signature)) {
      return { valid: false, payload: null, error: "Invalid signature" };
    }

    // Decode payload
    const payloadJson = base64urlDecode(payloadB64).toString("utf-8");
    const payload = JSON.parse(payloadJson) as LicensePayload;

    // Validate structure
    if (!payload.sub || typeof payload.sub !== "string") {
      return { valid: false, payload: null, error: "Missing customer identifier" };
    }

    if (!Array.isArray(payload.features)) {
      return { valid: false, payload: null, error: "Missing features list" };
    }

    if (typeof payload.exp !== "number") {
      return { valid: false, payload: null, error: "Missing expiry" };
    }

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, payload, error: "License expired" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null, error: "Failed to validate license key" };
  }
}

/**
 * Check if a specific feature is granted by a license payload.
 */
export function hasFeature(payload: LicensePayload, feature: Feature): boolean {
  return payload.features.includes(feature);
}

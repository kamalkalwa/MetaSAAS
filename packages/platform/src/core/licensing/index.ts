/**
 * Licensing Module
 *
 * Controls feature access based on license keys. Designed for loose coupling:
 *
 *   - Features call `isFeatureEnabled("ai.chat")` — no other dependency
 *   - License key is a JWT set via METASAAS_LICENSE_KEY env var
 *   - Without a key: FREE_FEATURES are enabled, everything else is locked
 *   - With a valid key: features listed in the key's payload are enabled
 *   - Invalid/expired key: treated as no key (free tier) + warning logged
 *
 * The platform has NO tier-to-feature mapping (no "pro includes X" logic).
 * That mapping lives in the license key itself — controlled by us when
 * we generate keys. Users can't see or modify which tier includes what.
 *
 * Usage:
 *   import { initLicensing, isFeatureEnabled, requireFeature, FEATURES } from "./licensing";
 *
 *   initLicensing(); // Call once at startup
 *
 *   if (isFeatureEnabled(FEATURES.AI_CHAT)) {
 *     // register AI chat routes
 *   }
 *
 *   requireFeature(FEATURES.WEBHOOKS); // throws FeatureLockedError if not enabled
 */

import { FREE_FEATURES, type Feature } from "./features.js";
import {
  validateLicenseKey,
  type LicensePayload,
  type LicenseValidationResult,
} from "./validator.js";

// Re-export for convenience
export { FEATURES, FREE_FEATURES, PRO_FEATURES, type Feature } from "./features.js";
export { validateLicenseKey, type LicensePayload, type LicenseValidationResult } from "./validator.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Current license state */
let enabledFeatures: Set<string> = new Set(FREE_FEATURES);
let currentLicense: LicensePayload | null = null;
let initialized = false;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when code calls requireFeature() for a feature that is not enabled.
 * Caught by the REST adapter and returned as a 402 (Payment Required).
 */
export class FeatureLockedError extends Error {
  public readonly feature: string;
  public readonly statusCode = 402;

  constructor(feature: string) {
    super(`Feature "${feature}" requires a valid license. Upgrade at https://metasaas.dev/pricing`);
    this.name = "FeatureLockedError";
    this.feature = feature;
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the licensing system.
 * Reads METASAAS_LICENSE_KEY from environment, validates it, and sets
 * the enabled feature set.
 *
 * Safe to call multiple times — idempotent.
 * Never throws — invalid keys fall back to free tier with a warning.
 */
export function initLicensing(): void {
  const key = process.env.METASAAS_LICENSE_KEY;

  if (!key) {
    enabledFeatures = new Set(FREE_FEATURES);
    currentLicense = null;
    initialized = true;
    console.log(
      `[licensing] No license key — free tier (${FREE_FEATURES.length} features enabled)`
    );
    return;
  }

  const result = validateLicenseKey(key);

  if (!result.valid) {
    enabledFeatures = new Set(FREE_FEATURES);
    currentLicense = null;
    initialized = true;
    console.warn(`[licensing] Invalid license key: ${result.error} — falling back to free tier`);
    return;
  }

  // Valid license — enable features from the key + free features
  const allFeatures = [...FREE_FEATURES, ...result.payload!.features];
  enabledFeatures = new Set(allFeatures);
  currentLicense = result.payload!;
  initialized = true;

  console.log(
    `[licensing] License valid for "${currentLicense.sub}" — ${enabledFeatures.size} features enabled`
  );
}

// ---------------------------------------------------------------------------
// Feature Checks
// ---------------------------------------------------------------------------

/**
 * Check if a feature is enabled in the current license.
 * Returns true if:
 *   - Feature is in FREE_FEATURES, OR
 *   - Feature is in the license key's features array
 *
 * Returns false if licensing has not been initialized (safe default).
 */
export function isFeatureEnabled(feature: Feature): boolean {
  if (!initialized) {
    // Not initialized yet — deny by default (safe)
    return FREE_FEATURES.includes(feature);
  }
  return enabledFeatures.has(feature);
}

/**
 * Require a feature to be enabled. Throws FeatureLockedError if not.
 * Use in route handlers and middleware to gate endpoints.
 *
 * The REST adapter catches FeatureLockedError and returns 402.
 */
export function requireFeature(feature: Feature): void {
  if (!isFeatureEnabled(feature)) {
    throw new FeatureLockedError(feature);
  }
}

/**
 * Get all currently enabled features. Used by the metadata endpoint
 * to inform the frontend which features are available.
 */
export function getEnabledFeatures(): string[] {
  return Array.from(enabledFeatures);
}

/**
 * Get the current license info (for admin display).
 * Returns null if no valid license.
 */
export function getLicenseInfo(): {
  customer: string;
  features: string[];
  expiresAt: Date;
} | null {
  if (!currentLicense) return null;
  return {
    customer: currentLicense.sub,
    features: currentLicense.features,
    expiresAt: new Date(currentLicense.exp * 1000),
  };
}

// ---------------------------------------------------------------------------
// Testing Helpers
// ---------------------------------------------------------------------------

/**
 * Reset licensing state (for testing only).
 */
export function resetLicensing(): void {
  enabledFeatures = new Set(FREE_FEATURES);
  currentLicense = null;
  initialized = false;
}

/**
 * Override enabled features (for testing only).
 */
export function setEnabledFeatures(features: Feature[]): void {
  enabledFeatures = new Set([...FREE_FEATURES, ...features]);
  initialized = true;
}

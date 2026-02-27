/**
 * Licensing Module Tests
 *
 * Tests feature gating, license validation, and graceful degradation.
 * Uses test helpers to mock license state — no real RSA keys needed.
 *
 * Updated to reflect simplified licensing:
 *   FREE: AI, views, webhooks, email, storage, billing, etc. (14 features)
 *   PRO: sso, white_label, advanced_rbac (3 features)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isFeatureEnabled,
  requireFeature,
  getEnabledFeatures,
  getLicenseInfo,
  resetLicensing,
  setEnabledFeatures,
  initLicensing,
  FeatureLockedError,
  FEATURES,
  FREE_FEATURES,
  PRO_FEATURES,
} from "./index.js";

describe("Licensing Module", () => {
  beforeEach(() => {
    resetLicensing();
    // Clear env var for each test
    delete process.env.METASAAS_LICENSE_KEY;
  });

  describe("initLicensing()", () => {
    it("initializes with free tier when no license key is set", () => {
      initLicensing();

      // All free features should be enabled
      for (const feature of FREE_FEATURES) {
        expect(isFeatureEnabled(feature)).toBe(true);
      }

      // Pro features should be disabled
      for (const feature of PRO_FEATURES) {
        expect(isFeatureEnabled(feature)).toBe(false);
      }
    });

    it("falls back to free tier on invalid license key", () => {
      process.env.METASAAS_LICENSE_KEY = "invalid.jwt.token";
      initLicensing();

      expect(isFeatureEnabled(FEATURES.SSO)).toBe(false); // pro feature
      expect(isFeatureEnabled(FEATURES.AI_CHAT)).toBe(true); // free feature
      expect(isFeatureEnabled(FEATURES.AUDIT_LOG)).toBe(true); // free feature
    });

    it("falls back to free tier on malformed JWT", () => {
      process.env.METASAAS_LICENSE_KEY = "not-even-a-jwt";
      initLicensing();

      expect(isFeatureEnabled(FEATURES.SSO)).toBe(false);
      expect(isFeatureEnabled(FEATURES.WHITE_LABEL)).toBe(false);
    });
  });

  describe("isFeatureEnabled()", () => {
    it("returns true for free features without initialization", () => {
      // Before initLicensing(), free features should still work
      for (const feature of FREE_FEATURES) {
        expect(isFeatureEnabled(feature)).toBe(true);
      }
    });

    it("returns true for all free features after init (generous free tier)", () => {
      initLicensing();

      // AI — all free
      expect(isFeatureEnabled(FEATURES.AI_CHAT)).toBe(true);
      expect(isFeatureEnabled(FEATURES.AI_COMMANDS)).toBe(true);
      expect(isFeatureEnabled(FEATURES.AI_ENTITY_GENERATION)).toBe(true);
      expect(isFeatureEnabled(FEATURES.AI_ENTITY_EVOLUTION)).toBe(true);

      // Views — all free
      expect(isFeatureEnabled(FEATURES.VIEW_KANBAN)).toBe(true);
      expect(isFeatureEnabled(FEATURES.VIEW_CALENDAR)).toBe(true);

      // Integrations — free
      expect(isFeatureEnabled(FEATURES.WEBHOOKS)).toBe(true);
      expect(isFeatureEnabled(FEATURES.EMAIL)).toBe(true);
      expect(isFeatureEnabled(FEATURES.STORAGE)).toBe(true);

      // Data operations — free
      expect(isFeatureEnabled(FEATURES.BULK_ACTIONS)).toBe(true);
      expect(isFeatureEnabled(FEATURES.IMPORT_EXPORT)).toBe(true);
      expect(isFeatureEnabled(FEATURES.AUDIT_LOG)).toBe(true);

      // Multi-tenancy — free
      expect(isFeatureEnabled(FEATURES.MULTI_TENANCY)).toBe(true);
    });

    it("returns false for pro features without license", () => {
      initLicensing();

      expect(isFeatureEnabled(FEATURES.SSO)).toBe(false);
      expect(isFeatureEnabled(FEATURES.WHITE_LABEL)).toBe(false);
      expect(isFeatureEnabled(FEATURES.ADVANCED_RBAC)).toBe(false);
    });

    it("returns true for billing as a free feature", () => {
      initLicensing();
      expect(isFeatureEnabled(FEATURES.BILLING)).toBe(true);
    });

    it("returns true for features enabled via setEnabledFeatures()", () => {
      setEnabledFeatures([FEATURES.SSO, FEATURES.WHITE_LABEL]);

      expect(isFeatureEnabled(FEATURES.SSO)).toBe(true);
      expect(isFeatureEnabled(FEATURES.WHITE_LABEL)).toBe(true);
      expect(isFeatureEnabled(FEATURES.ADVANCED_RBAC)).toBe(false);
    });

    it("always includes free features even when setting custom features", () => {
      setEnabledFeatures([FEATURES.SSO]);

      // Pro feature enabled
      expect(isFeatureEnabled(FEATURES.SSO)).toBe(true);
      // Free features still enabled (including billing)
      for (const feature of FREE_FEATURES) {
        expect(isFeatureEnabled(feature)).toBe(true);
      }
    });
  });

  describe("requireFeature()", () => {
    it("does not throw for enabled features", () => {
      setEnabledFeatures([FEATURES.SSO]);

      expect(() => requireFeature(FEATURES.SSO)).not.toThrow();
    });

    it("throws FeatureLockedError for disabled pro features", () => {
      initLicensing();

      expect(() => requireFeature(FEATURES.SSO)).toThrow(FeatureLockedError);
      expect(() => requireFeature(FEATURES.WHITE_LABEL)).toThrow(FeatureLockedError);
      expect(() => requireFeature(FEATURES.ADVANCED_RBAC)).toThrow(FeatureLockedError);
    });

    it("does not throw for billing (now a free feature)", () => {
      initLicensing();
      expect(() => requireFeature(FEATURES.BILLING)).not.toThrow();
    });

    it("FeatureLockedError has correct properties", () => {
      initLicensing();

      try {
        requireFeature(FEATURES.SSO);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FeatureLockedError);
        const locked = error as FeatureLockedError;
        expect(locked.feature).toBe("sso");
        expect(locked.statusCode).toBe(402);
        expect(locked.message).toContain("sso");
        expect(locked.message).toContain("license");
      }
    });

    it("does not throw for free features", () => {
      initLicensing();

      for (const feature of FREE_FEATURES) {
        expect(() => requireFeature(feature)).not.toThrow();
      }
    });
  });

  describe("getEnabledFeatures()", () => {
    it("returns all free features without license", () => {
      initLicensing();
      const features = getEnabledFeatures();
      expect(features).toEqual(expect.arrayContaining([...FREE_FEATURES]));
      expect(features.length).toBe(FREE_FEATURES.length);
    });

    it("returns free + pro features when pro is enabled", () => {
      setEnabledFeatures([FEATURES.SSO, FEATURES.WHITE_LABEL]);
      const features = getEnabledFeatures();
      expect(features).toContain(FEATURES.SSO);
      expect(features).toContain(FEATURES.WHITE_LABEL);
      // Free features still present (including billing)
      expect(features).toContain(FEATURES.AI_CHAT);
      expect(features).toContain(FEATURES.WEBHOOKS);
      expect(features).toContain(FEATURES.BILLING);
    });
  });

  describe("getLicenseInfo()", () => {
    it("returns null without license", () => {
      initLicensing();
      expect(getLicenseInfo()).toBeNull();
    });
  });

  describe("resetLicensing()", () => {
    it("resets to uninitialized state", () => {
      setEnabledFeatures([FEATURES.SSO]);
      expect(isFeatureEnabled(FEATURES.SSO)).toBe(true);

      resetLicensing();
      // After reset, pro features should be disabled
      expect(isFeatureEnabled(FEATURES.SSO)).toBe(false);
      // Free features still work (including billing)
      expect(isFeatureEnabled(FEATURES.AI_CHAT)).toBe(true);
      expect(isFeatureEnabled(FEATURES.BILLING)).toBe(true);
    });
  });
});

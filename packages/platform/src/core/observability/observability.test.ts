import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initObservability,
  resetObservability,
  captureException,
  captureMessage,
  setObservabilityContext,
  flushObservability,
  getObservabilityProvider,
  setObservabilityProvider,
  type ObservabilityProvider,
} from "./index.js";

beforeEach(() => {
  resetObservability();
  delete process.env.SENTRY_DSN;
  delete process.env.SENTRY_ENVIRONMENT;
});

describe("Observability Module", () => {
  describe("initObservability()", () => {
    it("uses console provider when no SENTRY_DSN is set", () => {
      initObservability();
      expect(getObservabilityProvider().name).toBe("console");
    });

    it("uses sentry provider when SENTRY_DSN is set", () => {
      process.env.SENTRY_DSN = "https://key@o0.ingest.sentry.io/0";
      initObservability();
      expect(getObservabilityProvider().name).toBe("sentry");
    });
  });

  describe("captureException()", () => {
    it("captures an error without throwing", () => {
      initObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() =>
        captureException(new Error("test error"), { tenantId: "t1" })
      ).not.toThrow();
      spy.mockRestore();
    });

    it("includes error details in console output", () => {
      initObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      captureException(new Error("boom"), { userId: "u1" });

      expect(spy).toHaveBeenCalledOnce();
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.message).toBe("boom");
      expect(output.event).toBe("exception");
      expect(output.userId).toBe("u1");
      spy.mockRestore();
    });
  });

  describe("captureMessage()", () => {
    it("routes info messages to console.log", () => {
      initObservability();
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      captureMessage("all good", "info");

      expect(spy).toHaveBeenCalledOnce();
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.message).toBe("all good");
      expect(output.level).toBe("info");
      spy.mockRestore();
    });

    it("routes error messages to console.error", () => {
      initObservability();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      captureMessage("bad thing", "error");

      expect(spy).toHaveBeenCalledOnce();
      const output = JSON.parse(spy.mock.calls[0][0] as string);
      expect(output.message).toBe("bad thing");
      expect(output.level).toBe("error");
      spy.mockRestore();
    });

    it("routes warning messages to console.warn", () => {
      initObservability();
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      captureMessage("heads up", "warning");

      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });

  describe("setObservabilityProvider()", () => {
    it("overrides the current provider", () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);
      expect(getObservabilityProvider().name).toBe("mock");
    });

    it("delegates captureException to the overridden provider", () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);

      const err = new Error("test");
      captureException(err, { userId: "u1" });
      expect(mock.captureException).toHaveBeenCalledWith(err, { userId: "u1" });
    });

    it("delegates captureMessage to the overridden provider", () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);

      captureMessage("hello", "warning", { tenantId: "t1" });
      expect(mock.captureMessage).toHaveBeenCalledWith("hello", "warning", { tenantId: "t1" });
    });

    it("delegates setContext to the overridden provider", () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);

      setObservabilityContext({ userId: "u1", tenantId: "t1" });
      expect(mock.setContext).toHaveBeenCalledWith({ userId: "u1", tenantId: "t1" });
    });
  });

  describe("flushObservability()", () => {
    it("resolves without error for console provider", async () => {
      initObservability();
      await expect(flushObservability()).resolves.toBeUndefined();
    });

    it("delegates to the overridden provider", async () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);

      await flushObservability(3000);
      expect(mock.flush).toHaveBeenCalledWith(3000);
    });
  });

  describe("resetObservability()", () => {
    it("resets to default console provider", () => {
      const mock: ObservabilityProvider = {
        name: "mock",
        captureException: vi.fn(),
        captureMessage: vi.fn(),
        setContext: vi.fn(),
        flush: vi.fn(async () => {}),
      };
      setObservabilityProvider(mock);
      expect(getObservabilityProvider().name).toBe("mock");

      resetObservability();
      expect(getObservabilityProvider().name).toBe("console");
    });
  });
});

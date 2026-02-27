import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initPlugins,
  registerPluginRoutes,
  getPlugin,
  getRegisteredPlugins,
  resetPlugins,
  type MetaSAASPlugin,
  type PluginContext,
} from "./index.js";

// Mock licensing to control feature gating
vi.mock("../licensing/index.js", () => ({
  isFeatureEnabled: vi.fn((f: string) => f !== "pro-billing"),
}));

beforeEach(() => {
  resetPlugins();
  vi.clearAllMocks();
});

function createTestPlugin(overrides?: Partial<MetaSAASPlugin>): MetaSAASPlugin {
  return {
    name: "test-plugin",
    version: "1.0.0",
    register: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("Plugin Host", () => {
  describe("initPlugins", () => {
    it("registers a plugin and makes it retrievable", async () => {
      const plugin = createTestPlugin();
      await initPlugins([plugin]);

      expect(getPlugin("test-plugin")).toBe(plugin);
      expect(getRegisteredPlugins()).toHaveLength(1);
    });

    it("calls register() with a valid PluginContext", async () => {
      let capturedCtx: PluginContext | null = null;
      const plugin = createTestPlugin({
        register: async (ctx) => {
          capturedCtx = ctx;
        },
      });

      await initPlugins([plugin]);

      expect(capturedCtx).not.toBeNull();
      expect(typeof capturedCtx!.registerAction).toBe("function");
      expect(typeof capturedCtx!.registerActions).toBe("function");
      expect(typeof capturedCtx!.subscribe).toBe("function");
      expect(typeof capturedCtx!.isFeatureEnabled).toBe("function");
      expect(typeof capturedCtx!.getEntity).toBe("function");
      expect(typeof capturedCtx!.getAllEntities).toBe("function");
      expect(typeof capturedCtx!.getDatabase).toBe("function");
      expect(typeof capturedCtx!.registerRoutes).toBe("function");
      expect(typeof capturedCtx!.logger).toBe("object");
    });

    it("registers multiple plugins in order", async () => {
      const pluginA = createTestPlugin({ name: "plugin-a" });
      const pluginB = createTestPlugin({ name: "plugin-b" });

      await initPlugins([pluginA, pluginB]);

      expect(getRegisteredPlugins()).toHaveLength(2);
      expect(getPlugin("plugin-a")).toBe(pluginA);
      expect(getPlugin("plugin-b")).toBe(pluginB);
    });

    it("handles empty plugin list without error", async () => {
      await initPlugins([]);
      expect(getRegisteredPlugins()).toHaveLength(0);
    });
  });

  describe("feature gating", () => {
    it("skips plugins with unmet feature requirements", async () => {
      const plugin = createTestPlugin({
        name: "billing-plugin",
        requires: ["pro-billing"],
      });

      await initPlugins([plugin]);

      // Plugin should NOT be registered because "pro-billing" is not enabled
      expect(getPlugin("billing-plugin")).toBeUndefined();
      expect(getRegisteredPlugins()).toHaveLength(0);
      expect(plugin.register).not.toHaveBeenCalled();
    });

    it("registers plugins whose features are all enabled", async () => {
      const plugin = createTestPlugin({
        requires: ["some-free-feature"],
      });

      await initPlugins([plugin]);

      expect(getPlugin("test-plugin")).toBe(plugin);
      expect(plugin.register).toHaveBeenCalledOnce();
    });
  });

  describe("error isolation", () => {
    it("catches plugin errors without crashing", async () => {
      const badPlugin = createTestPlugin({
        name: "bad-plugin",
        register: async () => {
          throw new Error("Plugin init exploded");
        },
      });
      const goodPlugin = createTestPlugin({ name: "good-plugin" });

      // Should not throw
      await initPlugins([badPlugin, goodPlugin]);

      // Bad plugin should NOT be registered
      expect(getPlugin("bad-plugin")).toBeUndefined();
      // Good plugin should still be registered
      expect(getPlugin("good-plugin")).toBe(goodPlugin);
    });
  });

  describe("plugin routes", () => {
    it("collects and applies route registrars", async () => {
      const routeHandler = vi.fn(async () => {});
      const plugin = createTestPlugin({
        register: async (ctx) => {
          await ctx.registerRoutes(routeHandler);
        },
      });

      await initPlugins([plugin]);

      // Simulate Fastify instance
      const fakeFastify = {} as any;
      await registerPluginRoutes(fakeFastify);

      expect(routeHandler).toHaveBeenCalledWith(fakeFastify);
    });

    it("applies routes from multiple plugins", async () => {
      const routeA = vi.fn(async () => {});
      const routeB = vi.fn(async () => {});

      const pluginA = createTestPlugin({
        name: "plugin-a",
        register: async (ctx) => {
          await ctx.registerRoutes(routeA);
        },
      });
      const pluginB = createTestPlugin({
        name: "plugin-b",
        register: async (ctx) => {
          await ctx.registerRoutes(routeB);
        },
      });

      await initPlugins([pluginA, pluginB]);

      const fakeFastify = {} as any;
      await registerPluginRoutes(fakeFastify);

      expect(routeA).toHaveBeenCalledOnce();
      expect(routeB).toHaveBeenCalledOnce();
    });
  });

  describe("resetPlugins", () => {
    it("clears all registered plugins and routes", async () => {
      const routeHandler = vi.fn(async () => {});
      const plugin = createTestPlugin({
        register: async (ctx) => {
          await ctx.registerRoutes(routeHandler);
        },
      });

      await initPlugins([plugin]);
      expect(getRegisteredPlugins()).toHaveLength(1);

      resetPlugins();
      expect(getRegisteredPlugins()).toHaveLength(0);

      // Routes should also be cleared
      const fakeFastify = {} as any;
      await registerPluginRoutes(fakeFastify);
      expect(routeHandler).not.toHaveBeenCalled();
    });
  });
});

/**
 * Notification Plugin
 *
 * MetaSAASPlugin that registers supplementary notification REST routes.
 *
 * Core notification routes (list, mark-read, mark-all-read) are already
 * registered by the REST adapter. This plugin adds the /unread count
 * endpoint and any future notification-specific functionality.
 */

import type { MetaSAASPlugin, PluginContext } from "../plugins/index.js";
import { getNotifications } from "./index.js";

export const notificationPlugin: MetaSAASPlugin = {
  name: "notifications",
  version: "1.0.0",

  async register(ctx: PluginContext) {
    ctx.registerRoutes(async (fastify) => {
      // GET /api/notifications/unread — get unread count only
      fastify.get("/api/notifications/unread", async (request, reply) => {
        const caller = request.caller;
        if (!caller) return reply.status(401).send({ success: false, error: "Authentication required" });

        const result = await getNotifications(caller.tenantId, caller.userId, { limit: 0 });
        return { success: true, data: { unread: result.unread } };
      });
    });

    ctx.logger.info("Notification routes registered");
  },
};

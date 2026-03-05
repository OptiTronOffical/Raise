// Extract admin check to a shared utility
function isAdmin(fastify, tgId) {
  if (!tgId) return false;
  const admins = String(fastify.config.ADMIN_TG_IDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return admins.includes(String(tgId));
}

export function settingsRoutes(fastify) {
  fastify.get("/requirements", async (request, reply) => {
    try {
      const s = await fastify.db.get(
        "SELECT value_json FROM settings WHERE key='required_channels'"
      );
      
      return { 
        ok: true,
        required_channels: s ? JSON.parse(s.value_json) : [] 
      };
    } catch (error) {
      fastify.log.error("Failed to fetch requirements:", error);
      return reply.code(500).send({ 
        ok: false, 
        reason: "internal_error" 
      });
    }
  });

  // Admin endpoints with proper authentication
  fastify.register(async function adminRoutes(instance) {
    // Add hook to check admin for all routes in this register
    instance.addHook('preHandler', async (req, reply) => {
      const adminId = Number(req.headers["x-admin-tg-id"] || 0);
      if (!isAdmin(fastify, adminId)) {
        return reply.code(403).send({ 
          ok: false, 
          reason: "forbidden" 
        });
      }
    });

    instance.get("/admin/required-channels", async (req, reply) => {
      try {
        const s = await fastify.db.get(
          "SELECT value_json FROM settings WHERE key='required_channels'"
        );
        return { 
          ok: true, 
          required_channels: s ? JSON.parse(s.value_json) : [] 
        };
      } catch (error) {
        fastify.log.error("Failed to fetch admin channels:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });

    instance.post("/admin/required-channels", async (req, reply) => {
      try {
        const channels = Array.isArray(req.body?.required_channels) 
          ? req.body.required_channels 
          : [];
        
        // Validate channel format
        const clean = channels
          .map(c => String(c).trim())
          .filter(c => {
            // Basic validation: non-empty and valid Telegram channel format
            return c && (c.startsWith('@') || /^[a-zA-Z0-9_]{5,}$/.test(c));
          });
        
        // Remove duplicates
        const unique = [...new Set(clean)];
        
        await fastify.db.run(
          "UPDATE settings SET value_json=? WHERE key='required_channels'",
          JSON.stringify(unique)
        );
        
        return { 
          ok: true, 
          required_channels: unique 
        };
      } catch (error) {
        fastify.log.error("Failed to update channels:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });
    
    // Add endpoint to get all settings (for admin)
    instance.get("/admin/settings", async (req, reply) => {
      try {
        const rows = await fastify.db.all(
          "SELECT key, value_json FROM settings WHERE key NOT LIKE 'daily_bonus:%'"
        );
        
        const settings = {};
        for (const row of rows) {
          settings[row.key] = JSON.parse(row.value_json);
        }
        
        return { ok: true, settings };
      } catch (error) {
        fastify.log.error("Failed to fetch settings:", error);
        return reply.code(500).send({ 
          ok: false, 
          reason: "internal_error" 
        });
      }
    });
  }, { prefix: '/bot' }); // Prefix all admin routes with /bot
}
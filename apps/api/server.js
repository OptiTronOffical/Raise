import Fastify from "fastify";
import cors from "@fastify/cors";
import env from "@fastify/env";
import dotenv from "dotenv";
import { openDb } from "./db.js";
import rateLimit from "@fastify/rate-limit";

import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { jackpotRoutes } from "./routes/jackpot.js";
import { txRoutes } from "./routes/transactions.js";
import { paymentRoutes } from "./routes/payments.js";
import { bonusRoutes } from "./routes/bonuses.js";
import { referralRoutes } from "./routes/referrals.js";
import { promoRoutes } from "./routes/promo.js";
import { settingsRoutes } from "./routes/settings.js";
import { botRoutes } from "./routes/bot.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";

dotenv.config();

const schema = {
  type: "object",
  required: ["BOT_TOKEN"],
  properties: {
    BOT_TOKEN: { type: "string" },
    ADMIN_TG_IDS: { type: "string", default: "" },
    PORT: { type: "string", default: "8787" },
    HOST: { type: "string", default: "0.0.0.0" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:3000" },
    NODE_ENV: { type: "string", default: "development" },
    LOG_LEVEL: { type: "string", default: "info" },

    ALLOW_DEMO_AUTH: { type: "string", default: "1" },
    SKIP_SUB_CHECK: { type: "string", default: "1" },

    DEMO_MODE: { type: "string", default: "1" },
    DEMO_MAIN_NFT_IDS: { type: "string", default: "1,2,3,4" },
    DEMO_MAIN_PROB: { type: "string", default: "0.9" },

    ROUND_TARGET_TON: { type: "string", default: "0.10" },
    MIN_BET_TON: { type: "string", default: "0.01" },
    RAKEBACK_PCT: { type: "string", default: "0.005" },
    REFERRAL_PCT: { type: "string", default: "0.0025" },
    MIN_WITHDRAW_TON: { type: "string", default: "1" },
    MAX_WITHDRAW_TON: { type: "string", default: "1000" },
    MIN_DEPOSIT_TON: { type: "string", default: "0.1" },
    MAX_DEPOSIT_TON: { type: "string", default: "1000" },
    TREASURY_ADDRESS: { type: "string", default: "" },
    
    // Rate limiting
    RATE_LIMIT_MAX: { type: "number", default: 100 },
    RATE_LIMIT_TIME_WINDOW: { type: "string", default: "1 minute" }
  }
};

async function buildServer() {
  // Create Fastify instance with appropriate logging
  const fastify = Fastify({ 
    logger: process.env.NODE_ENV === 'development' ? 
      { level: 'debug' } : 
      { level: 'info', file: './logs/server.log' },
    trustProxy: true,
    ajv: {
      customOptions: {
        coerceTypes: true // Allow type coercion for env vars
      }
    }
  });

  // Register plugins
  try {
    // Environment variables
    await fastify.register(env, { 
      schema, 
      dotenv: true,
      data: process.env // Allow overriding with process.env
    });

    // CORS
    await fastify.register(cors, { 
      origin: fastify.config.CORS_ORIGIN.split(','), // Allow multiple origins
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-init-data', 'x-admin-tg-id']
    });

    // Rate limiting
    await fastify.register(rateLimit, {
      max: fastify.config.RATE_LIMIT_MAX,
      timeWindow: fastify.config.RATE_LIMIT_TIME_WINDOW,
      errorResponseBuilder: (req, context) => ({
        ok: false,
        reason: 'rate_limit_exceeded',
        retry_after: context.after
      }),
      keyGenerator: (req) => {
        // Use x-forwarded-for header if behind proxy, otherwise use IP
        return req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress;
      }
    });

    // Database
    fastify.db = await openDb();
    fastify.log.info('Database connected successfully');

    // Health check with database
    fastify.get("/health", async (request, reply) => {
      try {
        // Check database connection
        await fastify.db.get("SELECT 1");
        return { 
          ok: true, 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: 'connected',
          uptime: process.uptime()
        };
      } catch (error) {
        fastify.log.error('Health check failed:', error);
        return reply.code(503).send({ 
          ok: false, 
          status: 'unhealthy',
          reason: 'database_error'
        });
      }
    });

    // Register routes
    const routes = [
      authRoutes,
      meRoutes,
      jackpotRoutes,
      txRoutes,
      paymentRoutes,
      bonusRoutes,
      referralRoutes,
      promoRoutes,
      settingsRoutes,
      botRoutes,
      leaderboardRoutes
    ];

    for (const route of routes) {
      try {
        route(fastify);
        fastify.log.debug(`Registered route: ${route.name}`);
      } catch (error) {
        fastify.log.error(`Failed to register route ${route.name}:`, error);
        throw error;
      }
    }

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error({
        err: error,
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body
        }
      }, 'Request error');

      // Handle specific error types
      if (error.validation) {
        return reply.code(400).send({
          ok: false,
          reason: 'validation_error',
          details: error.validation
        });
      }

      if (error.statusCode) {
        return reply.code(error.statusCode).send({
          ok: false,
          reason: error.message
        });
      }

      // Default error response
      reply.code(500).send({
        ok: false,
        reason: 'internal_server_error'
      });
    });

    // Not found handler
    fastify.setNotFoundHandler((request, reply) => {
      reply.code(404).send({
        ok: false,
        reason: 'route_not_found'
      });
    });

    return fastify;

  } catch (error) {
    console.error('Failed to build server:', error);
    throw error;
  }
}

// Start server function
async function startServer() {
  const fastify = await buildServer();
  
  try {
    const port = Number(fastify.config.PORT || 8787);
    const host = fastify.config.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    fastify.log.info(`
      🚀 Server listening on http://${host}:${port}
      📝 Environment: ${fastify.config.NODE_ENV}
      🔧 Demo mode: ${fastify.config.DEMO_MODE === '1' ? 'enabled' : 'disabled'}
      💰 Min bet: ${fastify.config.MIN_BET_TON} TON
      🎯 Round target: ${fastify.config.ROUND_TARGET_TON} TON
    `);

    // Graceful shutdown
    const shutdown = async (signal) => {
      fastify.log.info(`${signal} received, shutting down gracefully...`);
      
      try {
        // Close database connection
        if (fastify.db) {
          await fastify.db.close();
          fastify.log.info('Database connection closed');
        }
        
        // Close server
        await fastify.close();
        fastify.log.info('Server closed');
        
        process.exit(0);
      } catch (error) {
        fastify.log.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    fastify.log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { buildServer };
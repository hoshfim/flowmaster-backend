import { serve } from "@hono/node-server";
import app from "./app.js";
import { env } from "./config/env.js";
import { startRiskMonitor } from "./modules/scheduler/risk-monitor.job.js";

const PORT = env.PORT;

// ─── Start HTTP Server ────────────────────────────────────────────────────────

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`
╔══════════════════════════════════════════╗
║         FlowMaster AI  ▸  Backend        ║
╠══════════════════════════════════════════╣
║  Server   : http://localhost:${info.port}        ║
║  Env      : ${env.NODE_ENV.padEnd(30)}║
║  DB       : Neon PostgreSQL              ║
╚══════════════════════════════════════════╝
    `);
  }
);

// ─── Start Scheduled Jobs ─────────────────────────────────────────────────────

startRiskMonitor();

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdown = (signal: string) => {
  console.log(`\n[Server] Received ${signal} – shutting down gracefully`);
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

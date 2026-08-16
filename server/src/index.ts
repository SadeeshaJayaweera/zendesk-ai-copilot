import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { runMigrations } from "./db/migrate.js";
import { runHousekeeping } from "./utils/cleanup.js";

const app = createApp();

async function start() {
  try {
    await runMigrations();
  } catch (err: any) {
    logger.warn({ err: err.message }, "Database migration skipped (DB offline or starting up)");
  }

  // Periodic cache cleanup every 15 minutes
  setInterval(runHousekeeping, 15 * 60 * 1000);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "AI Reply Copilot server started");
  });
}

start();

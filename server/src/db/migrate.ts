import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";
import { logger } from "../config/logger.js";

/**
 * Robust, transactional database migration runner.
 * Tracks applied migrations in `schema_migrations` table to guarantee idempotency.
 */
export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const client = await pool.connect();
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(128) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Fetch applied migrations
    const { rows } = await client.query<{ version: string }>(
      "SELECT version FROM schema_migrations ORDER BY version ASC;"
    );
    const appliedVersions = new Set(rows.map((r) => r.version));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (appliedVersions.has(file)) {
        continue;
      }

      logger.info({ migration: file }, "Applying database migration");
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1);", [file]);
        await client.query("COMMIT");
        logger.info({ migration: file }, "Successfully applied migration");
      } catch (err: any) {
        await client.query("ROLLBACK");
        logger.error({ migration: file, err: err.message }, "Migration failed and was rolled back");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

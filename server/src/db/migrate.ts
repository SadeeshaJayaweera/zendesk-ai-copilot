import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool.js";
import { logger } from "../config/logger.js";

export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    logger.info({ migration: file }, "Executing database migration");
    await pool.query(sql);
  }
}

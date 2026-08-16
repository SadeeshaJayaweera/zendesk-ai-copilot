import { cleanupExpiredCache } from "../db/cacheRepo.js";
import { logger } from "../config/logger.js";

export async function runHousekeeping(): Promise<void> {
  try {
    const deletedCount = await cleanupExpiredCache();
    if (deletedCount > 0) {
      logger.info({ deletedCount }, "Cleaned up expired analysis cache rows");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Housekeeping run encountered minor issue");
  }
}

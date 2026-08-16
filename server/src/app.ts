import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { healthRouter } from "./routes/health.js";
import { ticketsRouter } from "./routes/tickets.js";
import { adminRouter } from "./routes/admin.js";

export function createApp(): Express {
  const app = express();
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== "production") {
          callback(null, true);
        } else {
          callback(new Error(`Origin not allowed: ${origin}`));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: false
    })
  );
  app.use(express.json({ limit: "512kb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: true
    })
  );

  app.use("/health", healthRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/admin", adminRouter);

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    req.log?.error({ err: err.message }, "Unhandled server error");
    res.status(500).json({
      error: "internal_error",
      message: "AI suggestions are temporarily unavailable."
    });
  });

  return app;
}

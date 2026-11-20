import { describe, it, expect, vi } from "vitest";
import { correlationIdMiddleware } from "../src/middleware/correlationId.js";
import { healthRouter } from "../src/routes/health.js";

describe("Phase 11: Observability, Health Checks & Telemetry", () => {
  describe("Correlation ID Middleware", () => {
    it("generates a UUIDv4 correlation ID and sets response header if missing in request", () => {
      const req: any = { headers: {} };
      const setHeaderMock = vi.fn();
      const res: any = { setHeader: setHeaderMock };
      const next = vi.fn();

      correlationIdMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.correlationId).toBeDefined();
      expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(setHeaderMock).toHaveBeenCalledWith("X-Correlation-ID", req.correlationId);
      expect(req.log).toBeDefined();
    });

    it("propagates an existing valid X-Correlation-ID header", () => {
      const existingId = "corp-trace-id-abc-123456";
      const req: any = {
        headers: { "x-correlation-id": existingId }
      };
      const setHeaderMock = vi.fn();
      const res: any = { setHeader: setHeaderMock };
      const next = vi.fn();

      correlationIdMiddleware(req, res, next);

      expect(req.correlationId).toBe(existingId);
      expect(setHeaderMock).toHaveBeenCalledWith("X-Correlation-ID", existingId);
    });

    it("falls back to generating new UUID if existing header contains invalid characters", () => {
      const maliciousHeader = "evil<script>alert(1)</script>";
      const req: any = {
        headers: { "x-correlation-id": maliciousHeader }
      };
      const setHeaderMock = vi.fn();
      const res: any = { setHeader: setHeaderMock };
      const next = vi.fn();

      correlationIdMiddleware(req, res, next);

      expect(req.correlationId).not.toBe(maliciousHeader);
      expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe("Health & Readiness Probes Router", () => {
    it("handles liveness probe GET /", () => {
      const layer = (healthRouter.stack as any[]).find(
        (l) => l.route?.path === "/" && l.route?.methods?.get
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {};
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("ok");
      expect(jsonPayload.service).toBe("ai-reply-copilot-server");
      expect(typeof jsonPayload.uptimeSeconds).toBe("number");
      expect(jsonPayload.timestamp).toBeDefined();
    });

    it("handles liveness probe GET /live", () => {
      const layer = (healthRouter.stack as any[]).find(
        (l) => l.route?.path === "/live" && l.route?.methods?.get
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {};
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("ok");
    });

    it("handles readiness probe GET /ready and verifies component health", async () => {
      const layer = (healthRouter.stack as any[]).find(
        (l) => l.route?.path === "/ready" && l.route?.methods?.get
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {};
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("ready");
      expect(jsonPayload.checks).toBeDefined();
      expect(jsonPayload.checks.aiProvider).toBe("healthy");
    });
  });
});

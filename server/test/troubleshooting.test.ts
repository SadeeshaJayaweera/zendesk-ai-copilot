import { describe, it, expect } from "vitest";
import { redactSecrets, sanitizeDiagnosticInput } from "../src/services/troubleshooting/sanitizer.js";
import { diagnoseTechnicalIssue } from "../src/services/troubleshooting/diagnoseIssue.js";
import type { DiagnosticInput } from "../src/types/troubleshooting.js";

describe("Phase 7: Advanced Support Engineering Intelligence", () => {
  describe("Secret & PII Sanitizer", () => {
    it("redacts Bearer tokens and Authorization headers", () => {
      const raw = "Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.sig with status 401";
      const { redactedText, count } = redactSecrets(raw);

      expect(count).toBeGreaterThan(0);
      expect(redactedText).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(redactedText).toContain("[REDACTED_TOKEN]");
    });

    it("redacts OpenAI and Stripe API keys", () => {
      const raw = "Connecting to Stripe with whsec_test_12345678901234567890 and OpenAI sk-abc12345678901234567890xyz";
      const { redactedText, count } = redactSecrets(raw);

      expect(count).toBe(2);
      expect(redactedText).not.toContain("sk-abc12345678901234567890xyz");
      expect(redactedText).not.toContain("whsec_test_12345678901234567890");
      expect(redactedText).toContain("[REDACTED_SECRET]");
    });

    it("sanitizes structured DiagnosticInput headers and payloads", () => {
      const input: DiagnosticInput = {
        integrationName: "Stripe Webhook",
        httpStatusCode: 403,
        endpointUrl: "https://api.example.com/v1/charge",
        errorMessage: "Access denied for token sk-prod12345678901234567890",
        requestPayload: '{"apiKey": "sk-prod12345678901234567890", "amount": 5000}',
        headers: {
          Authorization: "Bearer super-secret-jwt-token-here",
          "X-Custom-Header": "harmless-value"
        },
        category: "authentication_failure"
      };

      const { sanitized, redactedCount } = sanitizeDiagnosticInput(input);

      expect(redactedCount).toBeGreaterThan(0);
      expect(sanitized.errorMessage).not.toContain("sk-prod12345678901234567890");
      expect(sanitized.headers?.Authorization).toBe("[REDACTED_HEADER]");
      expect(sanitized.headers?.["X-Custom-Header"]).toBe("harmless-value");
    });
  });

  describe("Troubleshooting Diagnosis Engine", () => {
    it("generates structured troubleshooting report with read-only diagnostic steps", async () => {
      const input: DiagnosticInput = {
        integrationName: "Salesforce Sync Webhook",
        httpStatusCode: 504,
        endpointUrl: "https://sync.example.com/webhooks/salesforce",
        errorMessage: "504 Gateway Timeout: upstream did not respond within 30000ms",
        category: "timeout"
      };

      const report = await diagnoseTechnicalIssue(input);

      expect(report.primaryIssueSummary).toBeDefined();
      expect(report.classifiedCategory).toBe("timeout");
      expect(report.suggestions.length).toBeGreaterThan(0);

      const firstSuggestion = report.suggestions[0]!;
      expect(firstSuggestion.potentialRootCause).toBeDefined();
      expect(firstSuggestion.isHypothesis).toBe(true);
      expect(firstSuggestion.diagnosticSteps.length).toBeGreaterThan(0);

      // Verify Non-Negotiable Principle: Diagnostic commands must be strictly read-only
      for (const step of firstSuggestion.diagnosticSteps) {
        expect(step.isReadOnly).toBe(true);
        if (step.safeCommandOrQuery) {
          expect(step.safeCommandOrQuery).not.toMatch(/\b(rm\s+-rf|DROP|DELETE|UPDATE|TRUNCATE|reboot)\b/i);
        }
      }

      expect(report.safeCustomerExplanation).toBeDefined();
    });
  });
});

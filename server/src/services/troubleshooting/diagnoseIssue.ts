import {
  type DiagnosticInput,
  type TroubleshootingReport,
  troubleshootingReportSchema
} from "../../types/troubleshooting.js";
import { sanitizeDiagnosticInput } from "./sanitizer.js";
import { createStructuredCompletion } from "../ai/openaiClient.js";

export function buildTroubleshootingPrompts(input: DiagnosticInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a Senior Site Reliability and Support Systems Engineer.
Analyze the provided technical failure report (HTTP error, API integration failure, webhook error, database timeout, or configuration mismatch).

SAFETY & INTEGRITY CONSTRAINTS:
1. All diagnostic steps and commands MUST be strictly READ-ONLY (e.g. curl -I, GET requests, reading logs, ping, traceroute, SELECT queries).
2. NEVER recommend destructive commands (e.g. rm, DROP, DELETE, reboot, truncate, write updates).
3. Distinguish verifiable facts from AI-generated hypotheses ("isHypothesis": true).
4. Provide a clear, jargon-free explanation that can safely be communicated to customers without leaking internal architecture.

OUTPUT JSON SPECIFICATION:
Return ONLY valid JSON matching:
{
  "primaryIssueSummary": string,
  "classifiedCategory": "http_error" | "authentication_failure" | "authorization_failure" | "timeout" | "rate_limit" | "webhook_failure" | "data_mismatch" | "integration_error" | "invalid_payload" | "database_connectivity" | "configuration_problem" | "general",
  "severity": "low" | "medium" | "high" | "critical",
  "suggestions": [
    {
      "potentialRootCause": string,
      "isHypothesis": boolean,
      "confidence": number (between 0.0 and 1.0),
      "riskLevel": "low" | "medium" | "high" | "critical",
      "supportingEvidence": string[],
      "diagnosticSteps": [
        {
          "stepNumber": number,
          "description": string,
          "safeCommandOrQuery": string,
          "expectedOutcome": string,
          "isReadOnly": true
        }
      ],
      "recommendedNextAction": string,
      "requiredAdditionalInformation": string[]
    }
  ],
  "safeCustomerExplanation": string,
  "redactedTokensCount": number
}`;

  const userPrompt = `<technical_incident_context>
Integration: ${input.integrationName || "Standard API / Webhook"}
HTTP Status Code: ${input.httpStatusCode || "N/A"}
Endpoint: ${input.endpointUrl || "N/A"}
Category Hint: ${input.category}
Error Message:
${input.errorMessage || "(None provided)"}

Request Payload:
${input.requestPayload || "(None)"}

Response Payload:
${input.responsePayload || "(None)"}

Headers:
${input.headers ? JSON.stringify(input.headers, null, 2) : "(None)"}

Raw Diagnostic Logs:
${input.rawLogs || "(None)"}
</technical_incident_context>

Generate comprehensive support engineering diagnosis and output JSON.`;

  return { systemPrompt, userPrompt };
}

export async function diagnoseTechnicalIssue(
  rawInput: DiagnosticInput
): Promise<TroubleshootingReport> {
  const { sanitized, redactedCount } = sanitizeDiagnosticInput(rawInput);
  const { systemPrompt, userPrompt } = buildTroubleshootingPrompts(sanitized);

  const report = await createStructuredCompletion(
    systemPrompt,
    userPrompt,
    troubleshootingReportSchema
  );

  report.redactedTokensCount = redactedCount;
  return report;
}

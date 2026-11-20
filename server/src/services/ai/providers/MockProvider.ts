import { type z } from "zod";
import type {
  AIProvider,
  AIProviderCapabilities,
  AICompletionResult,
  CompletionOptions,
  ProviderHealth
} from "./types.js";

/**
 * Deterministic Mock AI Provider for offline development, integration testing,
 * and zero-credential environments. Guaranteed zero external API cost or latency.
 */
export class MockProvider implements AIProvider {
  public readonly name = "mock";

  public getCapabilities(): AIProviderCapabilities {
    return {
      structuredOutput: true,
      streaming: false,
      toolCalling: false,
      vision: false,
      localInference: true
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return { status: "healthy", latencyMs: 1, message: "Mock provider is ready" };
  }

  public async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    _options?: CompletionOptions
  ): Promise<AICompletionResult<T>> {
    const start = Date.now();
    let mockResponse: any = {};

    // 1. Conversation Analysis Response
    if (systemPrompt.includes("customer support") || systemPrompt.includes("Support Engineering Analyst") || userPrompt.includes("Sentiment:")) {
      const isFrustrated = /frustrated|angry|broken|urgent|down|fail/i.test(userPrompt);
      mockResponse = {
        customer_sentiment: isFrustrated ? "frustrated" : "neutral",
        customer_intent: /bill|invoice|charge/i.test(userPrompt) ? "billing" : "question",
        urgency: isFrustrated ? "high" : "medium",
        conversation_tone: isFrustrated ? "frustrated and seeking assistance" : "inquisitive",
        recommended_tone: isFrustrated ? "empathetic_direct" : "professional_helpful",
        response_length: "short",
        needs_apology: isFrustrated,
        needs_clarification: false,
        confidence: 0.95,
        business_impact: isFrustrated ? "high" : "medium",
        technical_complexity: "medium",
        frustration_level: isFrustrated ? "severe" : "none",
        repeated_contact_indicators: false,
        unanswered_questions: ["Why is the service failing to connect?"],
        missing_information: [],
        escalation_recommended: isFrustrated,
        escalation_reason: isFrustrated ? "Customer experiencing severe blocker on production printer." : null,
        observed_facts: ["Customer reported network printer offline on floor 3."],
        hypotheses: ["Possible switch port disconnection or DHCP lease expiration."],
        customer_commitments: []
      };
    }
    // 2. Draft Quality Analysis Response
    else if (systemPrompt.includes("quality assurance coach") || systemPrompt.includes("agent's draft reply")) {
      const hasRefund = /refund|credit|promise/i.test(userPrompt);
      mockResponse = {
        score: hasRefund ? 55 : 88,
        scores: {
          professionalism: 85,
          friendliness: 80,
          empathy: hasRefund ? 60 : 85,
          clarity: 90
        },
        strengths: ["Clear and grammatically correct phrasing"],
        issues: hasRefund
          ? [
              {
                type: "unsupported_promise",
                message: "Draft mentions financial refund without verified policy authorization.",
                severity: "critical"
              }
            ]
          : [],
        recommended_changes: hasRefund
          ? ["Consult billing lead before committing to refund amount."]
          : ["Draft is well-structured and ready for review."]
      };
    }
    // 3. Generate Reply Response
    else if (systemPrompt.includes("AI Support Copilot") || userPrompt.includes("Generate the optimal customer reply")) {
      mockResponse = {
        reply: "Hello,\n\nThank you for reaching out to us. I understand this situation is causing an issue and I am here to help. Could you please confirm if the issue is still persisting after a restart?\n\nBest regards,\nSupport Team",
        missing_information: [],
        tone_used: "empathetic_professional"
      };
    }
    // 4. Rewrite Draft Response
    else if (systemPrompt.includes("AI customer service editor") || userPrompt.includes("Rewrite the draft")) {
      const draftMatch = userPrompt.match(/=== SOURCE DRAFT ===\s*([\s\S]*?)(?:===|$)/);
      const draftText = draftMatch && draftMatch[1] ? draftMatch[1].trim() : "Hello, thank you for contacting support.";
      mockResponse = {
        rewrittenText: `Thank you for your patience. ${draftText}`,
        actionApplied: "improveTone"
      };
    }
    // 5. Troubleshooting Diagnostic Report
    else if (systemPrompt.includes("Site Reliability and Support Systems Engineer") || userPrompt.includes("technical_incident_context")) {
      mockResponse = {
        primaryIssueSummary: "Upstream HTTP 504 Gateway Timeout during payment integration call",
        classifiedCategory: "timeout",
        severity: "high",
        suggestions: [
          {
            potentialRootCause: "Payment gateway connection pool exhaustion or network socket hang",
            isHypothesis: true,
            confidence: 0.90,
            riskLevel: "medium",
            supportingEvidence: [
              "504 Gateway Timeout returned after 30,000ms",
              "Payment gateway API endpoint unreachable over TCP"
            ],
            diagnosticSteps: [
              {
                stepNumber: 1,
                description: "Check outbound TCP handshake latency to gateway endpoint",
                safeCommandOrQuery: "curl -Iv --connect-timeout 5 https://api.gateway.example.com/health",
                expectedOutcome: "HTTP 200 within 200ms",
                isReadOnly: true
              },
              {
                stepNumber: 2,
                description: "Inspect database connection pool metrics",
                safeCommandOrQuery: "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'",
                expectedOutcome: "Active connection count below threshold",
                isReadOnly: true
              }
            ],
            recommendedNextAction: "Engage payments infrastructure on-call and check payment provider status page.",
            requiredAdditionalInformation: [
              "Gateway transaction request ID (X-Request-Id)",
              "Outbound NAT gateway IP address"
            ]
          }
        ],
        safeCustomerExplanation: "We are investigating elevated response latency with our upstream payment gateway and have escalated to our engineering infrastructure team.",
        redactedTokensCount: 0
      };
    }
    // 6. Generic Fallback satisfying basic schemas
    else {
      mockResponse = {
        status: "success",
        message: "Deterministic mock AI completion completed successfully."
      };
    }

    // Validate generated mock response against target schema
    const validated = schema.safeParse(mockResponse);
    const data = validated.success ? validated.data : (mockResponse as T);

    const latencyMs = Date.now() - start;
    return {
      data,
      rawText: JSON.stringify(data),
      usage: {
        promptTokens: 120,
        completionTokens: 65,
        totalTokens: 185
      },
      modelUsed: "mock-v1",
      latencyMs
    };
  }
}

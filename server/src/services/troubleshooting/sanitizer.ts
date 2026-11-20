import type { DiagnosticInput } from "../../types/troubleshooting.js";

const SECRET_PATTERNS = [
  // Bearer tokens & JWTs
  /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
  // Standard API Keys (OpenAI, AWS, Zendesk, Stripe)
  /\b(sk-[a-zA-Z0-9_-]{20,})\b/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b(whsec_[a-zA-Z0-9_]{16,})\b/g,
  // Generic password/secret assignments in JSON or logs
  /("?(password|secret|apiKey|api_key|token|auth_token|client_secret)"?\s*[:=]\s*)"([^"]+)"/gi,
  // Credit card numbers (Luhn candidate 13-19 digits)
  /\b(?:\d[ -]*?){13,19}\b/g
];

export function redactSecrets(text: string): { redactedText: string; count: number } {
  if (!text) return { redactedText: "", count: 0 };

  let count = 0;
  let result = text;

  // 1. Redact Authorization headers specifically
  result = result.replace(/Authorization:\s*Bearer\s+[^\r\n]+/gi, () => {
    count++;
    return "Authorization: Bearer [REDACTED_TOKEN]";
  });
  result = result.replace(/Authorization:\s*Basic\s+[^\r\n]+/gi, () => {
    count++;
    return "Authorization: Basic [REDACTED_CREDENTIALS]";
  });

  // 2. Redact regex patterns
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      count++;
      if (match.toLowerCase().includes("bearer")) return "Bearer [REDACTED_TOKEN]";
      if (match.includes(":") || match.includes("=")) {
        return match.replace(/"[^"]+"$/, '"[REDACTED_SECRET]"');
      }
      return "[REDACTED_SECRET]";
    });
  }

  return { redactedText: result, count };
}

export function sanitizeDiagnosticInput(input: DiagnosticInput): {
  sanitized: DiagnosticInput;
  redactedCount: number;
} {
  let totalRedacted = 0;

  const sanitizeField = (val?: string) => {
    if (!val) return val;
    const { redactedText, count } = redactSecrets(val);
    totalRedacted += count;
    return redactedText;
  };

  const sanitizedHeaders: Record<string, string> = {};
  if (input.headers) {
    for (const [k, v] of Object.entries(input.headers)) {
      const lower = k.toLowerCase();
      if (lower.includes("auth") || lower.includes("key") || lower.includes("secret") || lower.includes("cookie")) {
        sanitizedHeaders[k] = "[REDACTED_HEADER]";
        totalRedacted++;
      } else {
        const { redactedText, count } = redactSecrets(v);
        totalRedacted += count;
        sanitizedHeaders[k] = redactedText;
      }
    }
  }

  const sanitized: DiagnosticInput = {
    ...input,
    errorMessage: sanitizeField(input.errorMessage),
    requestPayload: sanitizeField(input.requestPayload),
    responsePayload: sanitizeField(input.responsePayload),
    rawLogs: sanitizeField(input.rawLogs),
    headers: Object.keys(sanitizedHeaders).length > 0 ? sanitizedHeaders : input.headers
  };

  return {
    sanitized,
    redactedCount: totalRedacted
  };
}

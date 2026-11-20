import type { TicketContext } from "../../types/ticketContext.js";

export interface HallucinationGuardResult {
  hasWarning: boolean;
  warnings: string[];
  blocked: boolean;
  criticalViolations: string[];
}

// 1. Prohibited Financial & Commitment Patterns (Never authorized by LLM)
const FINANCIAL_COMMITMENT_PATTERNS = [
  { regex: /\b(i('ve| have| am)?|we('ve| have| are)?)\s+(issuing|issued|process(ing)?|approved?|grant(ing|ed)?|credit(ing|ed)?|refund(ing|ed)?)\b/i, label: "financial refund or credit" },
  { regex: /\b(will|can)\s+(issue|process|grant|send)\s+(you\s+)?(a\s+)?(full\s+)?(refund|credit)\b/i, label: "financial refund or credit" },
  { regex: /\b(issuing|issued|process(ing)?|approv(ing|ed)?|grant(ing|ed)?)\s+(you\s+)?(a\s+)?(full\s+)?(\d+%\s+)?(refund|credit)\b/i, label: "financial refund or credit" },
  { regex: /\b(refund|credit)\s+of\s+\$?\d+/i, label: "specific refund amount" },
  { regex: /\b(\d+%)(\s+off|\s+discount)\b/i, label: "percentage discount commitment" },
  { regex: /\b(free\s+month|waive\s+(your\s+)?fee|courtesy\s+credit)\b/i, label: "free service or fee waiver promise" },
  { regex: /\b(money\s*back\s*guarantee)\b/i, label: "money-back guarantee" }
];

// 2. Prohibited Unsupported Guarantees & Strict Timelines
const TIMELINE_GUARANTEE_PATTERNS = [
  { regex: /\b(we\s+guarantee|i\s+guarantee|guaranteed\s+by|we\s+promise\s+that)\b/i, label: "unauthorized guarantee" },
  { regex: /\b(will\s+be\s+(fixed|resolved|ready)\s+(within|in)\s+\d+\s+(hours|minutes|days))\b/i, label: "unauthorized resolution timeline promise" }
];

// 3. Unverified Technical Action Claims
const UNVERIFIED_ACTION_PATTERNS = [
  { regex: /\b(i('ve| have)|we('ve| have))\s+(fixed|deployed|restarted|reconfigured|restored|patched)\b/i, label: "unverified operational resolution claim" }
];

/**
 * Enterprise Anti-Hallucination & AI Safety Guard.
 * Implements defense-in-depth:
 * 1. Deterministic financial commitment blocking (Principle #12)
 * 2. Unverified operational claim detection
 * 3. Timeline guarantee detection
 * 4. Internal private note leakage detection (Principle #9)
 */
export function detectHallucinations(
  replyText: string,
  context: TicketContext
): HallucinationGuardResult {
  const warnings: string[] = [];
  const criticalViolations: string[] = [];

  // Check 1: Financial & unauthorized policy commitments
  // Under Principle #12: Even if the customer asked for a refund, an LLM reply must NEVER promise one.
  for (const item of FINANCIAL_COMMITMENT_PATTERNS) {
    if (item.regex.test(replyText)) {
      const msg = `Unauthorized commitment: '${item.label}' detected in reply. LLMs cannot authorize financial concessions.`;
      warnings.push(msg);
      criticalViolations.push(msg);
    }
  }

  // Check 2: Timeline guarantees
  for (const item of TIMELINE_GUARANTEE_PATTERNS) {
    if (item.regex.test(replyText)) {
      warnings.push(`Unauthorized guarantee: '${item.label}' detected in reply without verified SLA commitment.`);
    }
  }

  // Check 3: Unverified action claims
  const publicAgentNotes = context.messages
    .filter((m) => m.authorRole === "agent" && m.isPublic)
    .map((m) => m.body.toLowerCase())
    .join(" ");

  for (const item of UNVERIFIED_ACTION_PATTERNS) {
    if (item.regex.test(replyText)) {
      const verifiedInHistory = item.regex.test(publicAgentNotes);
      if (!verifiedInHistory) {
        warnings.push(`Unverified action: Reply claims '${item.label}' which is not confirmed in agent ticket history.`);
      }
    }
  }

  // Check 4: Private note contamination detection
  // Extract distinctive non-public phrases and check if they leak into replyText
  const privateNotes = context.messages.filter((m) => !m.isPublic);
  const publicText = [
    context.subject,
    context.description,
    ...context.messages.filter((m) => m.isPublic).map((m) => m.body)
  ].join(" ").toLowerCase();

  for (const note of privateNotes) {
    // Look for distinctive tokens in private notes (tokens >= 6 chars not in public text)
    const tokens = note.body
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 7 && isNaN(Number(t)));

    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      // If token is unique to private notes and appears in generated reply
      if (!publicText.includes(lowerToken) && replyText.toLowerCase().includes(lowerToken)) {
        const leakMsg = `Private data leakage detected: Internal term '${token}' from a private note appears in customer reply.`;
        warnings.push(leakMsg);
        criticalViolations.push(leakMsg);
        break;
      }
    }
  }

  return {
    hasWarning: warnings.length > 0,
    warnings,
    blocked: criticalViolations.length > 0,
    criticalViolations
  };
}

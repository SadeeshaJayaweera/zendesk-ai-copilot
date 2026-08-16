import type { TicketContext } from "../../types/ticketContext.js";

const SUSPICIOUS_PATTERNS = [
  { regex: /\b(refund|credit|reimburse|reimbursement)\b/i, label: "financial refund or credit" },
  { regex: /\b(\d+%)(\s+off|\s+discount)\b/i, label: "percentage discount" },
  { regex: /\b(free\s+month|waive\s+fee|courtesy\s+credit)\b/i, label: "free service or fee waiver" },
  { regex: /\b(guarantee|guaranteed\s+by|promise\s+that)\b/i, label: "unauthorized guarantee" },
  { regex: /\b(within\s+\d+\s+(hours|days|minutes))\b/i, label: "unauthorized timeline promise" }
];

export function detectHallucinations(
  replyText: string,
  context: TicketContext
): { hasWarning: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const fullSourceText = [
    context.subject,
    context.description,
    ...context.messages.map((m) => m.body)
  ].join(" ").toLowerCase();

  for (const item of SUSPICIOUS_PATTERNS) {
    if (item.regex.test(replyText)) {
      const matchInSource = item.regex.test(fullSourceText);
      if (!matchInSource) {
        warnings.push(`Potential hallucination detected: '${item.label}' mentioned in reply but not found in source conversation context.`);
      }
    }
  }

  return {
    hasWarning: warnings.length > 0,
    warnings
  };
}

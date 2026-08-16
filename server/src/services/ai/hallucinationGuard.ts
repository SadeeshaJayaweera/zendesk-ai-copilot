export const SUSPICIOUS_PATTERNS = [
  /\b(guarantee|promise)\b.{0,40}\b(full refund|100% refund|free lifetime)\b/i,
  /\b(waive|cancel)\b.{0,30}\b(all fees|any charges|your bill)\b/i,
  /\b(executive team|ceo|vp)\b.{0,30}\b(personally handle|call you)\b/i
];

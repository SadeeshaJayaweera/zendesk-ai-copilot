import type { ConversationAnalysis } from "../../types/ai.js";

export function recommendTone(analysis: ConversationAnalysis): string {
  const tones: string[] = [];

  if (analysis.customer_sentiment === "angry" || analysis.customer_sentiment === "frustrated") {
    tones.push("empathetic");
    tones.push("reassuring");
  } else if (analysis.customer_sentiment === "positive") {
    tones.push("warm");
    tones.push("enthusiastic");
  } else {
    tones.push("helpful");
  }

  if (analysis.urgency === "urgent" || analysis.urgency === "high") {
    tones.push("direct");
  } else {
    tones.push("professional");
  }

  if (analysis.needs_apology && !tones.includes("empathetic")) {
    tones.unshift("empathetic");
  }

  return [...new Set(tones)].slice(0, 3).join("_");
}

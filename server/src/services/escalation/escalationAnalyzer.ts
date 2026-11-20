import type { TicketContext, Message } from "../../types/ticketContext.js";

export interface SlaPolicyConfig {
  urgentFirstReplyMinutes?: number;
  highFirstReplyMinutes?: number;
  normalFirstReplyMinutes?: number;
  lowFirstReplyMinutes?: number;
  nextReplyMinutes?: number;
}

export interface EscalationReport {
  ticketId: number;
  priority: string;
  ticketAgeMinutes: number;
  customerWaitTimeMinutes: number;
  unansweredCustomerMessagesCount: number;
  slaStatus: "ok" | "warning" | "breached";
  slaDeadline: string | null;
  slaTimeRemainingMinutes: number | null;
  frustrationDetected: boolean;
  frustrationScore: number;
  recommendations: {
    requires_immediate_attention: boolean;
    possible_sla_breach: boolean;
    needs_technical_investigation: boolean;
    requires_engineering_escalation: boolean;
    waiting_for_customer: boolean;
    recommended_action: string;
    explanation: string;
  };
}

const DEFAULT_SLA: Required<SlaPolicyConfig> = {
  urgentFirstReplyMinutes: 30,
  highFirstReplyMinutes: 60,
  normalFirstReplyMinutes: 240,
  lowFirstReplyMinutes: 480,
  nextReplyMinutes: 120
};

const FRUSTRATION_KEYWORDS = [
  "unacceptable",
  "furious",
  "ridiculous",
  "manager",
  "escalate",
  "cancel my account",
  "lawsuit",
  "legal",
  "waiting for days",
  "no response",
  "terrible service",
  "still not working"
];

export function analyzeSlaAndEscalation(
  context: TicketContext,
  slaConfig: SlaPolicyConfig = {}
): EscalationReport {
  const cfg = { ...DEFAULT_SLA, ...slaConfig };
  const now = Date.now();

  const publicMessages = context.messages.filter((m) => m.isPublic);
  const firstMsg = publicMessages[0];
  const ticketCreatedAt = firstMsg ? new Date(firstMsg.createdAt).getTime() : now;
  const ticketAgeMinutes = Math.max(0, Math.floor((now - ticketCreatedAt) / 60000));

  // Count consecutive customer messages at tail of conversation
  let consecutiveCustomerMsgs = 0;
  let lastCustomerMsg: Message | null = null;
  let lastAgentMsg: Message | null = null;

  for (let i = publicMessages.length - 1; i >= 0; i--) {
    const msg = publicMessages[i]!;
    if (msg.authorRole === "customer") {
      if (!lastCustomerMsg) lastCustomerMsg = msg;
      if (!lastAgentMsg) consecutiveCustomerMsgs++;
    } else if (msg.authorRole === "agent") {
      if (!lastAgentMsg) lastAgentMsg = msg;
    }
  }

  const waitingForCustomer = Boolean(lastAgentMsg && (!lastCustomerMsg || new Date(lastAgentMsg.createdAt) > new Date(lastCustomerMsg.createdAt)));
  const customerWaitTimeMinutes = !waitingForCustomer && lastCustomerMsg
    ? Math.max(0, Math.floor((now - new Date(lastCustomerMsg.createdAt).getTime()) / 60000))
    : 0;

  // Determine SLA target
  let targetMinutes = cfg.normalFirstReplyMinutes;
  const prio = (context.priority || "normal").toLowerCase();
  if (prio === "urgent") targetMinutes = cfg.urgentFirstReplyMinutes;
  else if (prio === "high") targetMinutes = cfg.highFirstReplyMinutes;
  else if (prio === "low") targetMinutes = cfg.lowFirstReplyMinutes;

  if (lastAgentMsg && !waitingForCustomer) {
    targetMinutes = Math.min(targetMinutes, cfg.nextReplyMinutes);
  }

  let slaStatus: "ok" | "warning" | "breached" = "ok";
  let slaTimeRemainingMinutes: number | null = null;
  let slaDeadline: string | null = null;

  if (!waitingForCustomer && lastCustomerMsg) {
    const deadlineTime = new Date(lastCustomerMsg.createdAt).getTime() + targetMinutes * 60000;
    slaDeadline = new Date(deadlineTime).toISOString();
    slaTimeRemainingMinutes = Math.floor((deadlineTime - now) / 60000);

    if (slaTimeRemainingMinutes <= 0) {
      slaStatus = "breached";
    } else if (slaTimeRemainingMinutes <= targetMinutes * 0.3) {
      slaStatus = "warning";
    }
  }

  // Frustration scoring
  const allCustomerText = publicMessages
    .filter((m) => m.authorRole === "customer")
    .map((m) => m.body.toLowerCase())
    .join(" ");

  let matchedFrustrationTerms = 0;
  for (const kw of FRUSTRATION_KEYWORDS) {
    if (allCustomerText.includes(kw)) {
      matchedFrustrationTerms++;
    }
  }

  const frustrationScore = Math.min(1.0, Number((matchedFrustrationTerms * 0.25 + (consecutiveCustomerMsgs > 2 ? 0.3 : 0)).toFixed(2)));
  const frustrationDetected = frustrationScore >= 0.5;

  // Escalation recommendations
  const possibleSlaBreach = slaStatus === "warning" || slaStatus === "breached";
  const requiresImmediateAttention = prio === "urgent" || slaStatus === "breached" || frustrationScore >= 0.75;
  const isTechnical = context.tags.some((t) => ["bug", "api", "integration", "outage", "database", "500", "504"].includes(t.toLowerCase())) ||
    /error|500|504|timeout|exception|failure/i.test(context.subject + " " + context.description);
  const requiresEngineeringEscalation = isTechnical && (prio === "urgent" || consecutiveCustomerMsgs >= 2);

  let recommendedAction = "Review customer message and draft response.";
  let explanation = "Ticket is proceeding normally within SLA parameters.";

  if (slaStatus === "breached") {
    recommendedAction = "IMMEDIATE ACTION REQUIRED: Respond to customer now. SLA is breached.";
    explanation = `Customer has been waiting ${customerWaitTimeMinutes}m, exceeding the ${targetMinutes}m target.`;
  } else if (possibleSlaBreach) {
    recommendedAction = "Priority reply needed: Approaching SLA breach deadline.";
    explanation = `Only ${slaTimeRemainingMinutes}m remaining before response deadline.`;
  } else if (requiresEngineeringEscalation) {
    recommendedAction = "Escalate to Engineering On-Call: Complex technical failure identified.";
    explanation = "Critical technical error identified with repeated customer contacts.";
  } else if (waitingForCustomer) {
    recommendedAction = "Pending customer response. No agent action required at this time.";
    explanation = "Last response was sent by support agent.";
  }

  return {
    ticketId: context.ticketId,
    priority: context.priority || "normal",
    ticketAgeMinutes,
    customerWaitTimeMinutes,
    unansweredCustomerMessagesCount: consecutiveCustomerMsgs,
    slaStatus,
    slaDeadline,
    slaTimeRemainingMinutes,
    frustrationDetected,
    frustrationScore,
    recommendations: {
      requires_immediate_attention: requiresImmediateAttention,
      possible_sla_breach: possibleSlaBreach,
      needs_technical_investigation: isTechnical,
      requires_engineering_escalation: requiresEngineeringEscalation,
      waiting_for_customer: waitingForCustomer,
      recommended_action: recommendedAction,
      explanation
    }
  };
}

import crypto from "node:crypto";
import type { Message, TicketContext } from "../../types/ticketContext.js";

export function getLatestCustomerMessage(context: TicketContext): Message | null {
  const customerMsgs = context.messages.filter((m) => m.authorRole === "customer" && m.isPublic);
  return customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1] ?? null : null;
}

export function getRecentMessages(context: TicketContext, n = 5): Message[] {
  const publicMsgs = context.messages.filter((m) => m.isPublic);
  return publicMsgs.slice(Math.max(0, publicMsgs.length - n));
}

export function conversationHash(context: TicketContext): string {
  const publicMsgs = context.messages.filter((m) => m.isPublic);
  const data = publicMsgs.map((m) => `${m.id}:${m.authorRole}:${m.body}`).join("|");
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function filterCustomerFacingContext(context: TicketContext): TicketContext {
  return {
    ...context,
    messages: context.messages.filter((m) => m.isPublic)
  };
}

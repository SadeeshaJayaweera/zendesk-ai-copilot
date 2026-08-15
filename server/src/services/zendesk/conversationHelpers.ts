import type { Message, TicketContext } from "../../types/ticketContext.js";

export function getLatestCustomerMessage(context: TicketContext): Message | null {
  const customerMsgs = context.messages.filter((m) => m.authorRole === "customer" && m.isPublic);
  return customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1] ?? null : null;
}

export function getRecentMessages(context: TicketContext, n = 5): Message[] {
  const publicMsgs = context.messages.filter((m) => m.isPublic);
  return publicMsgs.slice(Math.max(0, publicMsgs.length - n));
}

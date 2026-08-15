import type { Message, TicketContext } from "../../types/ticketContext.js";

export function getLatestCustomerMessage(context: TicketContext): Message | null {
  const customerMsgs = context.messages.filter((m) => m.authorRole === "customer" && m.isPublic);
  return customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1] ?? null : null;
}

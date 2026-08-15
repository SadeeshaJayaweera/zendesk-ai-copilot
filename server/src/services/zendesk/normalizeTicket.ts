import type {
  AuthorRole,
  CustomField,
  Message,
  TicketContext
} from "../../types/ticketContext.js";

export interface ZendeskUserRaw {
  id: number;
  name?: string;
  role?: "end-user" | "agent" | "admin" | "system" | string;
}

export function deriveAuthorRole(
  authorId: number | null | undefined,
  requesterId: number | null | undefined,
  usersMap?: Map<number, ZendeskUserRaw>
): AuthorRole {
  if (authorId == null || authorId <= 0) {
    return "system";
  }
  if (usersMap && usersMap.has(authorId)) {
    const user = usersMap.get(authorId);
    if (user?.role === "end-user") return "customer";
    if (user?.role === "agent" || user?.role === "admin") return "agent";
    if (user?.role === "system") return "system";
  }
  if (requesterId != null && authorId === requesterId) {
    return "customer";
  }
  return "agent";
}

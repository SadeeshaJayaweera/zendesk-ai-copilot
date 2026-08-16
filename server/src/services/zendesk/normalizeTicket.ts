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

export interface ZendeskTicketRaw {
  id: number;
  subject?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  tags?: string[] | null;
  custom_fields?: Array<{ id: number; value?: unknown }> | null;
  requester_id?: number | null;
}

export interface ZendeskCommentRaw {
  id: number | string;
  type?: string;
  author_id?: number | null;
  body?: string | null;
  plain_body?: string | null;
  public?: boolean;
  created_at?: string;
}

export interface ZendeskTicketResponseRaw {
  ticket: ZendeskTicketRaw;
}

export interface ZendeskCommentsResponseRaw {
  comments: ZendeskCommentRaw[];
  users?: ZendeskUserRaw[];
}

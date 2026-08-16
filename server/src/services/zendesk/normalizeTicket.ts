import type {
  AuthorRole,
  CustomField,
  Message,
  TicketContext
} from "../../types/ticketContext.js";

export interface ZendeskCustomFieldRaw {
  id: number;
  value?: unknown;
}

export interface ZendeskTicketRaw {
  id: number;
  subject?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  tags?: string[] | null;
  custom_fields?: ZendeskCustomFieldRaw[] | null;
  requester_id?: number | null;
  submitter_id?: number | null;
  assignee_id?: number | null;
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

export interface ZendeskUserRaw {
  id: number;
  name?: string;
  role?: "end-user" | "agent" | "admin" | "system" | string;
}

export interface ZendeskTicketResponseRaw {
  ticket: ZendeskTicketRaw;
}

export interface ZendeskCommentsResponseRaw {
  comments: ZendeskCommentRaw[];
  users?: ZendeskUserRaw[];
}

/**
 * Derive the AuthorRole for a comment author strictly based on Zendesk IDs / roles.
 */
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
    if (user?.role === "end-user") {
      return "customer";
    }
    if (user?.role === "agent" || user?.role === "admin") {
      return "agent";
    }
    if (user?.role === "system") {
      return "system";
    }
  }

  if (requesterId != null && authorId === requesterId) {
    return "customer";
  }

  return "agent";
}

/**
 * Pure function to normalize raw Zendesk ticket and comment payloads
 * into the canonical TicketContext shape.
 */
export function normalizeTicket(
  rawTicket: ZendeskTicketRaw | ZendeskTicketResponseRaw,
  rawComments: ZendeskCommentRaw[] | ZendeskCommentsResponseRaw
): TicketContext {
  const ticket: ZendeskTicketRaw =
    "ticket" in rawTicket ? rawTicket.ticket : rawTicket;

  let commentsList: ZendeskCommentRaw[] = [];
  let usersMap: Map<number, ZendeskUserRaw> | undefined;

  if (Array.isArray(rawComments)) {
    commentsList = rawComments;
  } else if (rawComments && Array.isArray(rawComments.comments)) {
    commentsList = rawComments.comments;
    if (rawComments.users && Array.isArray(rawComments.users)) {
      usersMap = new Map<number, ZendeskUserRaw>();
      for (const u of rawComments.users) {
        usersMap.set(u.id, u);
      }
    }
  }

  const customFields: CustomField[] = Array.isArray(ticket.custom_fields)
    ? ticket.custom_fields.map((cf) => ({
        id: cf.id,
        value: cf.value
      }))
    : [];

  const messages: Message[] = commentsList.map((c) => {
    const authorRole = deriveAuthorRole(c.author_id, ticket.requester_id, usersMap);
    const body = c.plain_body ?? c.body ?? "";
    const isPublic = c.public !== false;
    const createdAt = c.created_at || new Date().toISOString();

    return {
      id: c.id,
      authorRole,
      body,
      createdAt,
      isPublic
    };
  });

  return {
    ticketId: ticket.id,
    subject: ticket.subject ?? "",
    description: ticket.description ?? "",
    status: ticket.status ?? "open",
    priority: ticket.priority ?? null,
    tags: Array.isArray(ticket.tags) ? ticket.tags : [],
    customFields,
    messages
  };
}

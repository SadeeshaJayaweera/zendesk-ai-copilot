export type AuthorRole = "customer" | "agent" | "system";

export interface Message {
  id: number | string;
  authorRole: AuthorRole;
  body: string;
  createdAt: string;
  isPublic: boolean;
}

export interface CustomField {
  id: number;
  value?: unknown;
}

export interface TicketContext {
  ticketId: number;
  subject: string;
  description: string;
  status: string;
  priority: string | null;
  tags: string[];
  customFields: CustomField[];
  messages: Message[];
}

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

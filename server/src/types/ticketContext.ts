import { z } from "zod";
import type { AuthorRole, CustomField, Message, TicketContext } from "../../../shared/types/ticketContext.js";

export type { AuthorRole, CustomField, Message, TicketContext };

export const authorRoleSchema = z.enum(["customer", "agent", "system"]);

export const messageSchema = z.object({
  id: z.union([z.number(), z.string()]),
  authorRole: authorRoleSchema,
  body: z.string(),
  createdAt: z.string(),
  isPublic: z.boolean()
});

export const customFieldSchema = z.object({
  id: z.number(),
  value: z.unknown().optional()
});

export const ticketContextSchema = z.object({
  ticketId: z.number(),
  subject: z.string(),
  description: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  tags: z.array(z.string()),
  customFields: z.array(customFieldSchema),
  messages: z.array(messageSchema)
});

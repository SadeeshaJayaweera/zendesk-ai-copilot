import { z } from "zod";
import type { AuthorRole, CustomField, Message, TicketContext } from "../../../shared/types/ticketContext.js";

export type { AuthorRole, CustomField, Message, TicketContext };

export const authorRoleSchema = z.enum(["customer", "agent", "system"]);

import { z } from "zod";

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "ENGAGED",
  "QUALIFIED",
  "NURTURE",
  "CONVERTED",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional().default(""),
  brokerageId: z.string().trim().optional().default(""),
  sourceId: z.string().trim().optional().default(""),
  status: z.enum(LEAD_STATUSES).default("NEW"),
  city: z.string().trim().max(80).optional().default(""),
  nextFollowUpAt: z.string().trim().optional().default(""),
  tags: z.string().trim().max(200).optional().default(""),
});

export const leadNoteSchema = z.object({
  summary: z.string().trim().min(1, "Write a note before saving").max(2000),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

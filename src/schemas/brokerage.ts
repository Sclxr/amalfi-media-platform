import { z } from "zod";

export const brokerageFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(200).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
});

export type BrokerageFormValues = z.infer<typeof brokerageFormSchema>;

export function brokerageNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

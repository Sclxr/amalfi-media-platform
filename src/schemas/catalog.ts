import { z } from "zod";

export const packageUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  price: z.string().trim().min(1, "Enter a price"),
  durationMin: z.coerce.number().int().min(15).max(24 * 60),
  maxSqft: z.string().trim().optional().default(""),
  active: z.enum(["true", "false"]),
});

export const serviceUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  pricingMode: z.enum(["FIXED", "QUOTE"]),
  price: z.string().trim().optional().default(""),
  active: z.enum(["true", "false"]),
});

export const areaUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  zipCodes: z.string().trim().max(500).optional().default(""),
  travelFee: z.string().trim().min(1, "Enter a travel fee"),
  active: z.enum(["true", "false"]),
});

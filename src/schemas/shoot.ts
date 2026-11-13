import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { parseDollarsToCents } from "@/lib/money";
import { zonedDateTime } from "@/lib/scheduling";

export const SHOOT_PROPERTY_TYPES = [
  "SINGLE_FAMILY",
  "CONDO",
  "TOWNHOUSE",
  "MULTI_FAMILY",
  "LAND",
  "COMMERCIAL",
  "RENTAL",
  "OTHER",
] as const;

export const shootFormSchema = z
  .object({
    realtorMode: z.enum(["existing", "new"]),
    leadId: z.string().trim().optional().default(""),
    firstName: z.string().trim().max(80).optional().default(""),
    lastName: z.string().trim().max(80).optional().default(""),
    email: z.string().trim().max(200).optional().default(""),
    phone: z.string().trim().max(40).optional().default(""),
    brokerage: z.string().trim().max(120).optional().default(""),
    addressLine1: z.string().trim().min(1, "Enter the street address.").max(160),
    city: z.string().trim().min(1, "Enter the city.").max(80),
    zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP."),
    propertyType: z.enum(SHOOT_PROPERTY_TYPES).default("SINGLE_FAMILY"),
    priceMode: z.enum(["package", "custom"]),
    packageId: z.string().trim().optional().default(""),
    addOnId: z.string().trim().optional().default(""),
    customLabel: z.string().trim().max(120).optional().default(""),
    customAmount: z.string().trim().optional().default(""),
    startLocal: z.string().trim().min(1, "Choose a date and time."),
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.realtorMode === "existing" && !value.leadId) {
      ctx.addIssue({ code: "custom", path: ["leadId"], message: "Choose a realtor, or add a new one." });
    }
    if (value.realtorMode === "new") {
      if (!value.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Enter a first name." });
      if (!value.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Enter a last name." });
      if (!normalizeEmail(value.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email." });
    }
    if (value.priceMode === "package" && !value.packageId) {
      ctx.addIssue({ code: "custom", path: ["packageId"], message: "Choose a package." });
    }
    if (value.priceMode === "custom") {
      if (!value.customLabel) ctx.addIssue({ code: "custom", path: ["customLabel"], message: "Name this price." });
      if (parseDollarsToCents(value.customAmount) === null) {
        ctx.addIssue({ code: "custom", path: ["customAmount"], message: "Enter a dollar amount." });
      }
    }
    if (!zonedDateTime(value.startLocal)) {
      ctx.addIssue({ code: "custom", path: ["startLocal"], message: "Choose a date and time." });
    }
  });

export type ShootFormValues = z.infer<typeof shootFormSchema>;

export function shootFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

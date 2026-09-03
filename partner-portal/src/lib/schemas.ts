import { z } from "zod";

export const dealRegistrationSchema = z.object({
  endCustomerName: z
    .string()
    .trim()
    .min(1, "End customer name is required"),
  endCustomerDomain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .transform((val) => val.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""))
    .refine(
      (val) => /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(val),
      { message: "Please enter a valid domain name (e.g., acme.com or sub.acme.co.uk)" }
    ),
  productSku: z
    .string()
    .trim()
    .min(1, "Product selection is required"),
  estimatedArr: z
    .number({ message: "Estimated ARR must be a number" })
    .positive("Estimated ARR must be greater than $0"),
  dealChannelType: z
    .enum(["resell", "referral", "distribution", "co_sell"])
    .default("resell"),
  partnerNotes: z.string().optional().default(""),
  coSellEligible: z.boolean().optional().default(false),
  requestedDiscountPct: z
    .number()
    .min(0, "Discount cannot be negative")
    .max(100, "Discount cannot exceed 100%")
    .optional(),
});

export type DealRegistrationInput = z.infer<typeof dealRegistrationSchema>;

export const mdfRequestSchema = z.object({
  campaignType: z.enum([
    "event_sponsorship",
    "digital_advertising",
    "content_webinar",
    "direct_mail",
    "sales_enablement",
    "demo_poc",
    "other",
  ]),
  programSource: z.enum(["partner_mdf", "microsoft_co_op"]).default("partner_mdf"),
  amountRequested: z
    .number({ message: "Amount requested must be a number" })
    .positive("Amount requested must be greater than $0"),
  quarter: z.enum(["q1", "q2", "q3", "q4"]).default("q1"),
  fiscalYear: z
    .number({ message: "Fiscal year must be a number" })
    .int()
    .min(2020, "Invalid fiscal year")
    .max(2100, "Invalid fiscal year"),
  activityStartDate: z.string().optional(),
  campaignDescription: z.string().optional(),
});

export type MdfRequestInput = z.infer<typeof mdfRequestSchema>;

export const dealNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Note cannot be empty"),
});

export type DealNoteInput = z.infer<typeof dealNoteSchema>;

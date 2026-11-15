import { z } from "zod";

/** Currencies the database accepts for a new cafe (see public.create_cafe). */
export const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري (EGP)" },
  { code: "SAR", label: "ريال سعودي (SAR)" },
  { code: "AED", label: "درهم إماراتي (AED)" },
  { code: "KWD", label: "دينار كويتي (KWD)" },
  { code: "QAR", label: "ريال قطري (QAR)" },
  { code: "USD", label: "دولار أمريكي (USD)" },
  { code: "EUR", label: "يورو (EUR)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const codes = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export const cafeSchema = z.object({
  name: z.string().trim().min(2, "اسم الكافيه يجب أن يكون حرفين على الأقل").max(120, "اسم الكافيه يجب ألا يزيد عن 120 حرف"),
  phone: z
    .string()
    .trim()
    .max(30, "رقم الهاتف طويل جداً")
    .refine((v) => v === "" || /^\+?[0-9\s-]{6,}$/.test(v), "اكتب رقم هاتف صحيح (أرقام فقط)"),
  address: z.string().trim().max(200, "العنوان يجب ألا يزيد عن 200 حرف"),
  currency: z.enum(codes, { errorMap: () => ({ message: "اختر العملة" }) }),
});

export type CafeInput = z.infer<typeof cafeSchema>;

import { z } from "zod";

export const cafeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "اسم الكافيه يجب أن يكون حرفين على الأقل")
    .max(120, "اسم الكافيه يجب ألا يزيد عن 120 حرف"),

  phone: z
    .string()
    .trim()
    .min(6, "اكتب رقم واتساب صحيح")
    .max(30, "رقم الهاتف طويل جداً")
    .regex(/^\+?[0-9\s-]{6,}$/, "اكتب رقم واتساب صحيح"),
  currency: z.literal("EGP"),
});

export type CafeInput = z.infer<typeof cafeSchema>;
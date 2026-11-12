type PgLikeError = { code?: string; message?: string; details?: string | null };

/** Turns database errors into short Arabic messages for the user. */
export function friendlyError(e: unknown): string {
  const err = (e ?? {}) as PgLikeError;
  const msg = err.message ?? String(e);
  switch (err.code) {
    case "23505":
      return "الاسم مستخدم بالفعل، اختر اسماً آخر";
    case "23503":
      return "لا يمكن الحذف لأن هذا العنصر مستخدم في ريسبي أو منتج أو إضافة";
    case "23514":
      return "قيمة غير صالحة، راجع الأرقام المدخلة";
    case "42501":
      return "ليس لديك صلاحية لهذا الإجراء، أو أن اشتراك الكافيه موقوف";
  }
  if (/row-level security/i.test(msg)) return "ليس لديك صلاحية لهذا الإجراء، أو أن اشتراك الكافيه موقوف";
  if (/Invalid login credentials/i.test(msg)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (/Email not confirmed/i.test(msg)) return "يجب تأكيد البريد الإلكتروني أولاً، راجع صندوق الوارد";
  if (/User already registered/i.test(msg)) return "هذا البريد مسجل بالفعل، سجّل الدخول";
  if (/Password should be/i.test(msg)) return "كلمة المرور ضعيفة، استخدم 8 أحرف على الأقل";
  return msg;
}

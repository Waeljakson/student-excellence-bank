import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const AUTH_URL = "https://ep-green-bar-b2rjvdpo.neonauth.c-6.eu-central-1.aws.neon.tech/excellence_bank/auth";
export const DATA_API_URL = "https://ep-green-bar-b2rjvdpo.apirest.c-6.eu-central-1.aws.neon.tech/excellence_bank/rest/v1";

export const neon: any = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: AUTH_URL,
    allowAnonymous: true,
  },
  dataApi: {
    url: DATA_API_URL,
  },
});

export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await neon.rpc(name, args);
  if (error) {
    const message = error?.message || error?.details || error?.hint || JSON.stringify(error);
    throw new Error(message);
  }
  return data as T;
}

export function niceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("APPROVAL_REQUIRED")) return "الحساب مسجل، لكنه ما زال بانتظار اعتماد الإدارة.";
  if (message.includes("ADMIN_REQUIRED")) return "هذه العملية متاحة للإدارة فقط.";
  if (message.includes("ISSUE_PERMISSION_REQUIRED")) return "لا توجد صلاحية إصدار لهذا الحساب.";
  if (message.includes("KHAMEESNA_DUPLICATE")) return "تم تسجيل نقاط لهذا الفصل من حسابك في نفس الحصة اليوم بالفعل.";
  if (message.includes("KHAMEESNA_WEEK_CLOSED")) return "خميسنا غير مغلقة يومي الجمعة والسبت. يبدأ أسبوع جديد يوم الأحد.";
  if (message.includes("KHAMEESNA_POINTS_RANGE")) return "نقاط خميسنا غير للحصة الواحدة من 1 إلى 10 نقاط.";
  if (message.includes("KHAMEESNA_LESSON_RANGE")) return "رقم الحصة يجب أن يكون من 1 إلى 8.";
  if (message.includes("CLASS_NOT_FOUND")) return "الفصل غير موجود أو لا يتبع العام الدراسي الحالي.";
  if (message.includes("Monthly point budget exceeded")) return "تم استهلاك الحد الشهري المسموح لإصدار النقاط.";
  if (message.includes("Points outside allowed range")) return "عدد النقاط خارج النطاق المسموح لهذه الفئة.";
  return message;
}

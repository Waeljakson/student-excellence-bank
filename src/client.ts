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
  if (message.includes("ADMIN_REQUIRED")) return "هذه العملية متاحة لإدارة النظام فقط.";
  if (message.includes("ISSUE_PERMISSION_REQUIRED")) return "لا توجد صلاحية إصدار لهذا الحساب.";
  if (message.includes("CLASS_SCOPE_REQUIRED")) return "هذا الفصل غير مسند لهذا المعلم. لا يمكن منح نقاط لطلابه.";
  if (message.includes("MEGA_CHECK_RESTRICTED")) return "الشيك العملاق متاح فقط لمدير المدرسة أو الوكيل أو الموجه الطلابي المرتبط وظيفيًا بالنظام.";
  if (message.includes("KHAMEESNA_DAILY_DUPLICATE") || message.includes("KHAMEESNA_DUPLICATE")) return "تم منح هذا الفصل نقاط خميسنا غير من حسابك اليوم بالفعل. المسموح مرة واحدة يوميًا لكل فصل.";
  if (message.includes("KHAMEESNA_WEEK_CLOSED")) return "خميسنا غير مغلقة يومي الجمعة والسبت. يبدأ أسبوع جديد يوم الأحد.";
  if (message.includes("KHAMEESNA_POINTS_RANGE")) return "نقاط خميسنا غير للإضافة الواحدة من 1 إلى 10 نقاط.";
  if (message.includes("KHAMEESNA_LESSON_RANGE")) return "رقم الحصة يجب أن يكون من 1 إلى 8.";
  if (message.includes("TEACHER_CLASS_REQUIRED")) return "لا يمكن اعتماد المعلم قبل تحديد فصل واحد على الأقل له.";
  if (message.includes("TEACHER_ONLY_ASSIGNMENT")) return "تسكين الفصول متاح للمعلمين فقط.";
  if (message.includes("STAFF_ALREADY_LINKED")) return "هذا الاسم مرتبط بحساب مستخدم آخر بالفعل.";
  if (message.includes("STAFF_NOT_FOUND")) return "لم يتم العثور على الموظف في دليل الهيئة.";
  if (message.includes("CLASS_NOT_FOUND")) return "الفصل غير موجود أو لا يتبع العام الدراسي الحالي.";
  if (message.includes("DEPARTMENT_NOT_FOUND")) return "القسم المختار غير موجود أو غير متاح لهذه المدرسة.";
  if (message.includes("CURRENT_ACADEMIC_YEAR_NOT_FOUND")) return "لا يوجد عام دراسي حالي مضبوط في النظام.";
  if (message.includes("IMPORT_ROWS_EMPTY") || message.includes("IMPORT_ROWS_REQUIRED")) return "لا توجد صفوف طلاب صالحة للاستيراد.";
  if (message.includes("IMPORT_CHUNK_TOO_LARGE")) return "عدد الطلاب في دفعة الاستيراد كبير جدًا. سيتم تقسيم الملف إلى دفعات تلقائيًا.";
  if (message.includes("schema cache") || message.includes("Could not find the function")) return "يتم الآن تحديث ربط النظام بقاعدة البيانات. أعد المحاولة بعد لحظات.";
  if (message.includes("Monthly point budget exceeded")) return "تم استهلاك الحد الشهري المسموح لإصدار النقاط.";
  if (message.includes("Points outside allowed range")) return "عدد النقاط خارج النطاق المسموح لهذه الفئة.";
  return message;
}

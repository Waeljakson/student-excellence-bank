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
  if (message.includes("APPROVAL_REQUIRED")) return "الحساب غير مرتبط بالنظام. استخدم طريقة الدخول المخصصة لك.";
  if (message.includes("SUPER_ADMIN_REQUIRED")) return "هذه الإعدادات متاحة لمدير النظام فقط.";
  if (message.includes("ADMIN_REQUIRED")) return "هذه العملية متاحة لإدارة النظام فقط.";
  if (message.includes("TEACHER_BUDGET_SUPER_ADMIN_REQUIRED")) return "تعديل الحد الشهري للمعلم متاح لمدير النظام فقط.";
  if (message.includes("ISSUE_PERMISSION_REQUIRED")) return "لا توجد صلاحية إصدار لهذا الحساب.";
  if (message.includes("CLASS_SCOPE_REQUIRED")) return "هذا الفصل غير مسند لحسابك.";
  if (message.includes("MEGA_ONLY_ROLE")) return "مدير المدرسة والوكيل والموجه الطلابي مسموح لهم فقط بشيك التميز العملاق.";
  if (message.includes("MEGA_CHECK_RESTRICTED")) return "الشيك العملاق متاح فقط لمدير المدرسة أو الوكيل أو الموجه الطلابي.";
  if (message.includes("MONTHLY_POINT_LIMIT_EXCEEDED")) return "تم استهلاك الحد الشهري المسموح لإصدار النقاط. سيتجدد الرصيد تلقائيًا مع بداية الشهر القادم.";
  if (message.includes("TEACHER_MONTHLY_LIMIT_100")) return "تم استهلاك الحد الشهري المسموح للمعلم. سيتجدد الرصيد تلقائيًا مع بداية الشهر القادم.";
  if (message.includes("POINT_CONVERSION_INVALID")) return "عدد النقاط مقابل الريال يجب أن يكون من 1 إلى 100.";
  if (message.includes("BEHAVIORAL_PERIOD_INVALID")) return "مدة دورة التميز السلوكي غير صحيحة. يجب أن تكون النهاية بعد البداية.";
  if (message.includes("BEHAVIORAL_PERIOD_OVERLAP")) return "توجد دورة تميز سلوكي أخرى متداخلة مع هذه المدة.";
  if (message.includes("BEHAVIORAL_CYCLE_NOT_FOUND")) return "دورة التميز السلوكي غير موجودة.";
  if (message.includes("GUIDANCE_REQUIRED")) return "هذه العملية متاحة للموجه الطلابي فقط.";
  if (message.includes("TEACHER_REQUIRED")) return "هذه العملية متاحة للمعلم فقط.";
  if (message.includes("BEHAVIORAL_NOT_SCHEDULED")) return "هذه الدورة ليست في حالة انتظار التفعيل.";
  if (message.includes("BEHAVIORAL_PERIOD_ENDED")) return "انتهت مدة هذه الدورة ولا يمكن تفعيلها.";
  if (message.includes("BEHAVIORAL_ALREADY_CLOSED")) return "هذه الدورة مغلقة بالفعل.";
  if (message.includes("BEHAVIORAL_NOT_ACTIVE")) return "التميز السلوكي غير مفتوح للترشيح الآن.";
  if (message.includes("BEHAVIORAL_THREE_REQUIRED") || message.includes("BEHAVIORAL_THREE_UNIQUE_REQUIRED")) return "يجب اختيار 3 طلاب مختلفين بالضبط من الفصل.";
  if (message.includes("BEHAVIORAL_STUDENT_SCOPE_INVALID")) return "أحد الطلاب المختارين لا يتبع هذا الفصل.";
  if (message.includes("REDEMPTION_MIN_50")) return "الحد الأدنى لطلب استبدال النقاط هو 50 نقطة.";
  if (message.includes("REDEMPTION_WINDOW_CLOSED")) return "متجر الهدايا مغلق حاليًا. انتظر حتى يفتحه الموجه الطلابي.";
  if (message.includes("REDEMPTION_PENDING_EXISTS")) return "لديك طلب هدية قائم بالفعل. انتظر تسليمه أو رفضه قبل طلب هدية جديدة.";
  if (message.includes("REDEMPTION_NOT_FOUND")) return "طلب الهدية غير موجود.";
  if (message.includes("REDEMPTION_NOT_PENDING")) return "تم التعامل مع هذا الطلب بالفعل ولا يمكن تنفيذه مرة أخرى.";
  if (message.includes("REWARD_MANAGE_REQUIRED")) return "لا توجد صلاحية إدارة متجر المكافآت لهذا الحساب.";
  if (message.includes("REWARD_NAME_REQUIRED")) return "اكتب اسم الهدية قبل الحفظ.";
  if (message.includes("REWARD_POINTS_INVALID")) return "تكلفة الهدية بالنقاط غير صحيحة.";
  if (message.includes("REWARD_STOCK_INVALID")) return "قيمة مخزون الهدية غير صحيحة.";
  if (message.includes("REWARD_HAS_PENDING_REQUESTS")) return "لا يمكن حذف هذه الهدية لأن عليها طلبات طلاب معلقة. نفّذ الطلبات أو ارفضها أولًا.";
  if (message.includes("REWARD_NOT_FOUND")) return "هذه الهدية غير متاحة حاليًا في متجر المكافآت.";
  if (message.includes("REWARD_OUT_OF_STOCK")) return "نفدت كمية هذه الهدية حاليًا. اختر هدية أخرى أو انتظر تجديد المخزون.";
  if (message.includes("INSUFFICIENT_STUDENT_POINTS")) return "رصيد الطالب الحالي لا يكفي للحصول على هذه الهدية.";
  if (message.includes("CHECK_NOT_OWNED_BY_TEACHER")) return "لا يمكنك إيقاف هذا الشيك لأنه لم يصدر من حسابك.";
  if (message.includes("CHECK_CANNOT_BE_STOPPED")) return "هذا الشيك ليس في حالة تسمح بإيقافه الآن.";
  if (message.includes("CHECK_REVERSE_BALANCE_TOO_LOW")) return "لا يمكن إيقاف الشيك لأن رصيد الطالب الحالي أقل من نقاط الشيك بعد عمليات لاحقة. راجع الموجه الطلابي.";
  if (message.includes("STAFF_ALREADY_CLAIMED")) return "هذا الموظف مرتبط بحساب آخر بالفعل.";
  if (message.includes("COMPETITION_CLASSES_REQUIRED")) return "اختر فصلًا واحدًا على الأقل للمسابقة.";
  if (message.includes("COMPETITION_CRITERIA_REQUIRED") || message.includes("COMPETITION_CRITERIA_INVALID")) return "أضف معيارًا صحيحًا واحدًا على الأقل للمسابقة.";
  if (message.includes("COMPETITION_DATES_INVALID") || message.includes("COMPETITION_DATE_RANGE_INVALID")) return "مدة المسابقة غير صحيحة. يجب أن يكون تاريخ النهاية بعد البداية.";
  if (message.includes("COMPETITION_REQUIRED")) return "أدخل اسم المسابقة ووصفها قبل الإطلاق.";
  if (message.includes("KHAMEESNA_DAILY_DUPLICATE") || message.includes("KHAMEESNA_DUPLICATE")) return "تم منح هذا الفصل نقاط خميسنا غير من حسابك اليوم بالفعل. المسموح مرة واحدة يوميًا لكل فصل.";
  if (message.includes("KHAMEESNA_WEEK_CLOSED")) return "خميسنا غير مغلقة يومي الجمعة والسبت. يبدأ أسبوع جديد يوم الأحد.";
  if (message.includes("KHAMEESNA_POINTS_RANGE")) return "نقاط خميسنا غير للإضافة الواحدة من 1 إلى 10 نقاط.";
  if (message.includes("KHAMEESNA_LESSON_RANGE")) return "رقم الحصة يجب أن يكون من 1 إلى 8.";
  if (message.includes("STAFF_CLASS_REQUIRED") || message.includes("TEACHER_CLASS_REQUIRED")) return "يجب تحديد فصل واحد على الأقل لهذا الموظف.";
  if (message.includes("STAFF_CLASS_ROLE_REQUIRED") || message.includes("TEACHER_ONLY_ASSIGNMENT")) return "تسكين الفصول متاح للمعلم ومدير المدرسة والوكيل والموجه الطلابي.";
  if (message.includes("STAFF_ALREADY_LINKED")) return "هذا الاسم مرتبط بحساب مستخدم آخر بالفعل.";
  if (message.includes("STAFF_NOT_FOUND")) return "لم يتم العثور على الموظف في دليل الهيئة.";
  if (message.includes("CLASS_NOT_FOUND")) return "الفصل غير موجود أو لا يتبع العام الدراسي الحالي.";
  if (message.includes("DEPARTMENT_NOT_FOUND")) return "القسم المختار غير موجود أو غير متاح لهذه المدرسة.";
  if (message.includes("CURRENT_ACADEMIC_YEAR_NOT_FOUND")) return "لا يوجد عام دراسي حالي مضبوط في النظام.";
  if (message.includes("STUDENT_NO_10_DIGITS_REQUIRED")) return "رقم الطالب يجب أن يتكون من 10 أرقام.";
  if (message.includes("STUDENT_NAME_REQUIRED")) return "اكتب اسم الطالب كاملًا.";
  if (message.includes("STUDENT_NO_EXISTS")) return "رقم الطالب موجود بالفعل في قاعدة المدرسة.";
  if (message.includes("STUDENT_MOBILE_INVALID")) return "رقم الجوال غير صحيح. استخدم الصيغة 05xxxxxxxx.";
  if (message.includes("IMPORT_ROWS_EMPTY") || message.includes("IMPORT_ROWS_REQUIRED")) return "لا توجد صفوف طلاب صالحة للاستيراد.";
  if (message.includes("IMPORT_CHUNK_TOO_LARGE")) return "عدد الطلاب في دفعة الاستيراد كبير جدًا. سيتم تقسيم الملف إلى دفعات تلقائيًا.";
  if (message.includes("schema cache") || message.includes("Could not find the function")) return "يتم الآن تحديث ربط النظام بقاعدة البيانات. أعد المحاولة بعد لحظات.";
  if (message.includes("Monthly point budget exceeded")) return "تم استهلاك الحد الشهري المسموح لإصدار النقاط.";
  if (message.includes("Points outside allowed range")) return "عدد النقاط خارج النطاق المسموح لهذه الفئة.";
  return message;
}

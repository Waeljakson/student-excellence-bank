import { createClient } from "@neondatabase/neon-js";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const AUTH_URL = "https://ep-green-bar-b2rjvdpo.neonauth.c-6.eu-central-1.aws.neon.tech/excellence_bank/auth";
export const DATA_API_URL = "https://ep-green-bar-b2rjvdpo.apirest.c-6.eu-central-1.aws.neon.tech/excellence_bank/rest/v1";


// IOS_AUTH_FALLBACK_V54
const AUTH_FALLBACK_KEY="mishkat-ios-auth-v1";
export const AUTH_FALLBACK_EVENT="mishkat-auth-fallback";

type AuthFallback={token:string;userId:string;exp:number};

function decodeJwtPayload(token:string):any|null{
  try{
    const parts=String(token||"").split(".");
    if(parts.length!==3)return null;
    let body=parts[1].replace(/-/g,"+").replace(/_/g,"/");
    while(body.length%4)body+="=";
    return JSON.parse(atob(body));
  }catch{return null}
}

function readStoredFallback():AuthFallback|null{
  const stores:any[]=[];
  try{stores.push(window.localStorage)}catch{}
  try{stores.push(window.sessionStorage)}catch{}
  for(const store of stores){
    try{
      const raw=store.getItem(AUTH_FALLBACK_KEY);
      if(!raw)continue;
      const parsed=JSON.parse(raw) as AuthFallback;
      if(!parsed?.token||!parsed?.userId||!parsed?.exp)continue;
      if(parsed.exp*1000<=Date.now()+15000){
        try{store.removeItem(AUTH_FALLBACK_KEY)}catch{}
        continue;
      }
      return parsed;
    }catch{}
  }
  return null;
}

export function getValidAuthFallback():AuthFallback|null{
  return typeof window==="undefined"?null:readStoredFallback();
}

export function getFallbackAuthUserId():string{
  return getValidAuthFallback()?.userId||"";
}

export function hasValidAuthFallback():boolean{
  return !!getValidAuthFallback();
}

export function clearAuthFallback(){
  if(typeof window==="undefined")return;
  try{window.localStorage.removeItem(AUTH_FALLBACK_KEY)}catch{}
  try{window.sessionStorage.removeItem(AUTH_FALLBACK_KEY)}catch{}
  window.dispatchEvent(new Event(AUTH_FALLBACK_EVENT));
}

export function captureAuthResult(result:any):boolean{
  if(typeof window==="undefined")return false;
  const data=result?.data||result;
  const token=String(data?.session?.token||"");
  const payload=decodeJwtPayload(token);
  const exp=Number(payload?.exp||0);
  const userId=String(data?.user?.id||payload?.sub||"");
  if(!token||!userId||!Number.isFinite(exp)||exp*1000<=Date.now()+15000)return false;
  const stored:AuthFallback={token,userId,exp};
  const raw=JSON.stringify(stored);
  let saved=false;
  try{window.localStorage.setItem(AUTH_FALLBACK_KEY,raw);saved=true}catch{}
  try{window.sessionStorage.setItem(AUTH_FALLBACK_KEY,raw);saved=true}catch{}
  if(saved)window.dispatchEvent(new Event(AUTH_FALLBACK_EVENT));
  return saved;
}

export const neon: any = createClient({
  auth: {
    adapter: BetterAuthReactAdapter({fetchOptions:{credentials:"include"} as any}),
    url: AUTH_URL,
    allowAnonymous: true,
  },
  dataApi: {
    url: DATA_API_URL,
  },
});

const fallbackDataClient:any=createClient({
  dataApi:{
    url:DATA_API_URL,
    getToken:async()=>getValidAuthFallback()?.token||null,
  },
} as any);

const originalNeonSignOut=neon.auth.signOut.bind(neon.auth);
neon.auth.signOut=async(...args:any[])=>{
  try{return await originalNeonSignOut(...args)}
  finally{clearAuthFallback()}
};

function rpcErrorMessage(error:any){
  return error?.message||error?.details||error?.hint||String(error||"تعذر تنفيذ الطلب");
}
function isAuthSessionError(message:string){
  return /AuthRequiredError|Authentication required|AUTH_REQUIRED|JWT expired|jwt expired|token.*expired|invalid.*jwt|invalid.*token|PGRST301|401|Unauthorized/i.test(message);
}
function isSchemaCacheError(message:string){
  return /schema cache|Could not find the function/i.test(message);
}
async function runRpc<T>(client:any,name:string,args:Record<string,unknown>):Promise<T>{
  const {data,error}=await client.rpc(name,args);
  if(error)throw new Error(rpcErrorMessage(error));
  return data as T;
}

export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  let primaryError:unknown=null;
  for(let attempt=0;attempt<4;attempt++){
    try{
      return await runRpc<T>(neon,name,args);
    }catch(error){
      primaryError=error;
      const message=rpcErrorMessage(error);
      const fallback=getValidAuthFallback();
      if(fallback&&isAuthSessionError(message)){
        try{
          return await runRpc<T>(fallbackDataClient,name,args);
        }catch(fallbackError){
          const fallbackMessage=rpcErrorMessage(fallbackError);
          if(isAuthSessionError(fallbackMessage))clearAuthFallback();
          throw fallbackError;
        }
      }
      const retryable=isSchemaCacheError(message)||/APP_USER_REQUIRED|APPROVAL_REQUIRED|JWT expired|token.*expired/i.test(message);
      if(!retryable||attempt===3)throw error;
      await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
    }
  }
  throw primaryError instanceof Error?primaryError:new Error("تعذر تنفيذ الطلب");
}

export function niceError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("APPROVAL_REQUIRED")) return "الحساب غير مرتبط بالنظام. استخدم طريقة الدخول المخصصة لك.";
  if (message.includes("SUPER_ADMIN_REQUIRED")) return "هذه الإعدادات متاحة لمدير النظام فقط.";
  if (message.includes("ADMIN_REQUIRED")) return "هذه العملية متاحة لإدارة النظام فقط.";
  if (message.includes("TEACHER_BUDGET_SUPER_ADMIN_REQUIRED")) return "تعديل الحد الشهري للمعلم متاح لمدير النظام فقط.";
  if (message.includes("ISSUE_PERMISSION_REQUIRED")) return "لا توجد صلاحية إصدار لهذا الحساب.";
  if (message.includes("CLASS_SCOPE_REQUIRED")) return "هذا الفصل غير مسند لحسابك.";
  if (message.includes("PERIODIC_SUBJECT_EXCLUDED")) return "التربية البدنية غير مشمولة في التقييم الدوري.";
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
  if (message.includes("STAFF_NAME_INVALID")) return "اسم المعلم غير صالح. اكتب الاسم الصحيح كاملًا.";
  if (message.includes("STAFF_NAME_EXISTS")) return "يوجد موظف آخر مسجل بنفس الاسم.";
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

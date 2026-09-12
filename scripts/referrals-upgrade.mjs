import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('import ReferralCenter from "./ReferralCenter";')){
  src=src.replace('import UserAccount from "./UserAccount";','import UserAccount from "./UserAccount";\nimport ReferralCenter from "./ReferralCenter";');
}

src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"referrals"')?m:m.slice(0,-1)+' | "referrals";');

if(!src.includes('nav.splice(Math.min(3,nav.length),0,["referrals"')){
  src=src.replace('  nav.push(["account","حسابي","◉"]);','  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.splice(Math.min(3,nav.length),0,["referrals","تحويلات الطلاب","↗"]);\n  nav.push(["account","حسابي","◉"]);');
}

if(!src.includes('tab==="referrals"&&<ReferralCenter')){
  src=src.replace('{tab==="rewards"&&<RewardsView rewards={rewards}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}', '{tab==="rewards"&&<RewardsView rewards={rewards}/>} {tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="khameesna"&&<KhameesnaCompetition/>}');
}

writeFileSync(appPath,src);

const clientPath="src/client.ts";
let client=readFileSync(clientPath,"utf8");
if(!client.includes('TEACHER_REFERRAL_REQUIRED')){
  const marker='  if (message.includes("SUPER_ADMIN_REQUIRED"))';
  const lines=`  if (message.includes("TEACHER_REFERRAL_REQUIRED")) return "إنشاء تحويل طالب متاح للمعلم فقط.";\n  if (message.includes("REFERRAL_TARGET_INVALID")) return "اختر جهة التحويل: وكيل المدرسة أو الموجه الطلابي.";\n  if (message.includes("REFERRAL_CATEGORY_INVALID")) return "اختر تصنيف المخالفة: تعليمية أو سلوكية.";\n  if (message.includes("REFERRAL_OCCURRENCE_INVALID")) return "حدد هل المخالفة أول مرة أم مكررة.";\n  if (message.includes("REFERRAL_FIELDS_REQUIRED")) return "أكمل وصف المخالفة وتفسيرها والإجراء الأول الذي اتخذه المعلم.";\n  if (message.includes("REFERRAL_NOT_FOUND")) return "التحويل غير موجود أو لا ينتمي لمدرستك.";\n  if (message.includes("REFERRAL_ALREADY_COMPLETED")) return "هذا التحويل منتهٍ بالفعل وموجود في الأرشيف.";\n  if (message.includes("REFERRAL_RECIPIENT_REQUIRED")) return "هذا التحويل غير موجه لصلاحيتك.";\n  if (message.includes("DEDUCTION_POINTS_INVALID")) return "أدخل عدد نقاط صحيحًا أكبر من صفر.";\n  if (message.includes("DEDUCTION_ALREADY_APPLIED")) return "تم خصم نقاط لهذا التحويل بالفعل، ولا يسمح بتكرار الخصم لنفس التحويل.";\n  if (message.includes("INSUFFICIENT_STUDENT_POINTS")) return "رصيد الطالب لا يكفي لعدد النقاط المطلوب خصمها.";\n  if (message.includes("REFERRAL_STATUS_INVALID")) return "حالة التحويل المطلوبة غير صحيحة.";\n`;
  if(client.includes(marker)) client=client.replace(marker,lines+marker);
  else client=client.replace('export function niceError',lines+'export function niceError');
  writeFileSync(clientPath,client);
}

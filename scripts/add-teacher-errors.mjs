import { readFileSync, writeFileSync } from "node:fs";

const path = "src/client.ts";
let src = readFileSync(path, "utf8");
const anchor = '  if (message.includes("STAFF_CLASS_REQUIRED") || message.includes("TEACHER_CLASS_REQUIRED")) return "يجب تحديد فصل واحد على الأقل لهذا الموظف.";';
const block = `  if (message.includes("TEACHER_NAME_REQUIRED")) return "اكتب اسم المعلم بشكل صحيح.";\n  if (message.includes("TEACHER_MOBILE_INVALID")) return "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05.";\n  if (message.includes("TEACHER_NAME_EXISTS")) return "يوجد معلم بنفس الاسم بالفعل في دليل الهيئة.";\n  if (message.includes("TEACHER_MOBILE_EXISTS")) return "رقم الجوال مستخدم بالفعل لموظف آخر في دليل الهيئة.";\n${anchor}`;
if (!src.includes("TEACHER_MOBILE_EXISTS") && src.includes(anchor)) src = src.replace(anchor, block);
writeFileSync(path, src);

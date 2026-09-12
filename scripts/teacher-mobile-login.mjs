import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('import TeacherLogin from "./TeacherLogin";')){
  src=src.replace('import StudentLogin from "./StudentLogin";','import StudentLogin from "./StudentLogin";\nimport TeacherLogin from "./TeacherLogin";');
}

src=src.replace('useState<"otp" | "register" | "password" | "student">("otp")','useState<"otp" | "register" | "password" | "teacher" | "student">("otp")');

if(!src.includes('>دخول المعلم</button>')){
  src=src.replace('<button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setMessage("")}}>إنشاء حساب معلم</button>', '<button className={mode==="teacher"?"active":""} onClick={()=>{setMode("teacher");setMessage("")}}>دخول المعلم</button>\n        <button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setMessage("")}}>إنشاء حساب بالبريد</button>');
}

if(!src.includes('{mode==="teacher"&&<TeacherLogin/>}')){
  src=src.replace('{mode==="student"&&<StudentLogin/>}', '{mode==="teacher"&&<TeacherLogin/>}\n      {mode==="student"&&<StudentLogin/>}');
}

src=src.replace('<h2>إنشاء حساب معلم</h2><p>إنشاء الحساب لا يمنح صلاحية إصدار الشيكات تلقائيًا؛ الإدارة تعتمدها من لوحة الصلاحيات.</p>', '<h2>إنشاء حساب بالبريد</h2><p>المعلمون يستخدمون تبويب «دخول المعلم» برقم الجوال. هذا الخيار للحسابات الأخرى التي تعتمدها الإدارة.</p>');

writeFileSync(appPath,src);

const clientPath="src/client.ts";
let client=readFileSync(clientPath,"utf8");
if(!client.includes('TEACHER_ALREADY_CLAIMED')){
  client=client.replace('  if (message.includes("STUDENT_ALREADY_CLAIMED"))', '  if (message.includes("TEACHER_NOT_FOUND")) return "رقم الجوال غير موجود ضمن المعلمين المسجلين.";\n  if (message.includes("TEACHER_ALREADY_CLAIMED")) return "هذا المعلم مرتبط بحساب آخر بالفعل.";\n  if (message.includes("ACCOUNT_MOBILE_MISMATCH")) return "رقم الجوال لا يطابق حساب الدخول.";\n  if (message.includes("STUDENT_ALREADY_CLAIMED"))');
  writeFileSync(clientPath,client);
}

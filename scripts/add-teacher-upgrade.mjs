import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let app = readFileSync(appPath, "utf8");

if (!app.includes('import AddTeacherPanel from "./AddTeacherPanel";')) {
  app = app.replace('import RewardManagementPanel from "./RewardManagementPanel";', 'import RewardManagementPanel from "./RewardManagementPanel";\nimport AddTeacherPanel from "./AddTeacherPanel";');
}

if (!app.includes('<AddTeacherPanel classes={classes} reload={reload}/>')) {
  app = app.replace('<RewardPermissionPanel users={users} reload={reload}/>', '<AddTeacherPanel classes={classes} reload={reload}/>\n    <RewardPermissionPanel users={users} reload={reload}/>');
}

writeFileSync(appPath, app);

const clientPath = "src/client.ts";
let client = readFileSync(clientPath, "utf8");
if (!client.includes('TEACHER_MOBILE_EXISTS')) {
  client = client.replace('  if (message.includes("TEACHER_REQUIRED")) return "هذه العملية متاحة للمعلم فقط.";', '  if (message.includes("TEACHER_REQUIRED")) return "هذه العملية متاحة للمعلم فقط.";\n  if (message.includes("TEACHER_NAME_REQUIRED")) return "اكتب اسم المعلم بشكل صحيح.";\n  if (message.includes("TEACHER_MOBILE_INVALID")) return "رقم جوال المعلم يجب أن يكون 10 أرقام ويبدأ بـ 05.";\n  if (message.includes("TEACHER_NAME_EXISTS")) return "يوجد معلم مسجل بهذا الاسم بالفعل.";\n  if (message.includes("TEACHER_MOBILE_EXISTS")) return "رقم الجوال مسجل لموظف آخر بالفعل.";');
  writeFileSync(clientPath, client);
}

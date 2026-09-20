import {readdirSync,readFileSync} from "node:fs";
const dir="dist/assets";
const files=readdirSync(dir).filter(x=>x.endsWith(".js"));
const required=[
  "api_guardian_lookup",
  "followup_notes",
  "متوسطة وثانوية مشكاة الشعلة",
  "student-tabs",
  "ملاحظات المعلمين",
  "شيكات التميز",
  "api_delete_negative_followup_note",
  "حذف الملاحظة",
  "guardian_unique_visitors",
  "متابعة أولياء الأمور",
  "تنبيه أو معلومة عامة",
  "guardian-followup-days",
  "ملاحظات هذا اليوم"
];
const bundle=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");
const missing=required.filter(x=>!bundle.includes(x));
if(missing.length)throw new Error("production-build-assert: missing "+missing.join(", "));
console.log("production-build-assert: guardian portal, followup controls, and guardian visit counter are present");

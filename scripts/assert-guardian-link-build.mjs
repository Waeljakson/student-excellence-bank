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
  "حذف الملاحظة",\n  "guardian_unique_visitors",\n  "متابعة أولياء الأمور"
];
const bundle=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");
const missing=required.filter(x=>!bundle.includes(x));
if(missing.length)throw new Error("production-build-assert: missing "+missing.join(", "));
console.log("production-build-assert: parent portal and tabbed student portal are present");

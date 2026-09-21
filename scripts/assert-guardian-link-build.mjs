import {readdirSync,readFileSync} from "node:fs";
const dir="dist/assets";
const files=readdirSync(dir).filter(x=>x.endsWith(".js"));
const required=[
  "api_guardian_lookup",
  "followup_notes",
  "متوسطة وثانوية مشكاة الشعلة",
  "student-tabs",
  "ملاحظات المعلمين",
  "كل الفصول",
  "followup-note-scroll",
  "HOMEWORK",
  "متابعة الواجبات اليوم",
  "شيكات التميز",
  "api_delete_negative_followup_note",
  "حذف الملاحظة",
  "guardian_unique_visitors",
  "متابعة أولياء الأمور",
  "تنبيه أو معلومة عامة",
  "guardian-followup-days",
  "ملاحظات هذا اليوم",
  "التقييم التحصيلي",
  "guardian-eval-table",
  "جيد جدًا",
  "api_archive_student",
  "حذف الطالب نهائيًا",
  "student-row-actions",
  "إضافة طالب"
];
const bundle=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");
const missing=required.filter(x=>!bundle.includes(x));
if(missing.length)throw new Error("production-build-assert: missing "+missing.join(", "));
console.log("production-build-assert: guardian portal, followup controls, and guardian visit counter are present");

const builtIndex=readFileSync("dist/index.html","utf8");
const parentManifest=JSON.parse(readFileSync("dist/parent-manifest.webmanifest","utf8"));
if(!builtIndex.includes("parent-manifest.webmanifest"))throw new Error("production-build-assert: parent manifest selector missing");
if(parentManifest.id!=="/student-excellence-bank/parent-portal"||parentManifest.start_url!=="/student-excellence-bank/?parent=1"){
  throw new Error("production-build-assert: guardian PWA identity/start URL invalid");
}
console.log("production-build-assert: separate guardian PWA verified");

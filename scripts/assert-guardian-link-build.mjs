import {readdirSync,readFileSync} from "node:fs";
const dir="dist/assets";
const files=readdirSync(dir).filter(x=>x.endsWith(".js"));
const required=[
  "api_guardian_lookup",
  "followup_notes",
  "متوسطة وثانوية مشكاة الشعلة"
];
const bundle=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");
const missing=required.filter(x=>!bundle.includes(x));
if(missing.length)throw new Error("production-build-assert: missing "+missing.join(", "));
console.log("production-build-assert: parent portal, school branding, and student followup are present");

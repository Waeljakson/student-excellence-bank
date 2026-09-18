import {readdirSync,readFileSync} from "node:fs";
const dir="dist/assets";
const files=readdirSync(dir).filter(x=>x.endsWith(".js"));
const required=[
  "api_guardian_link_for_student",
  "api_regenerate_guardian_link",
  "api_guardian_portal_by_student_no",
  "api_student_followup_self"
];
const bundle=files.map(file=>readFileSync(`${dir}/${file}`,"utf8")).join("\n");
const missing=required.filter(x=>!bundle.includes(x));
if(missing.length)throw new Error("production-build-assert: missing "+missing.join(", "));
console.log("production-build-assert: guardian identity portal and student followup are present");

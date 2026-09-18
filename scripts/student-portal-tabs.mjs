import {readFileSync} from "node:fs";
const file="src/StudentPortal.tsx";
const s=readFileSync(file,"utf8");
const required=[
  'type StudentTab=',
  'className="student-tabs"',
  'tab==="home"',
  'tab==="followup"',
  'tab==="account"'
];
const missing=required.filter(x=>!s.includes(x));
if(missing.length)throw new Error("student-portal-tabs: tabbed layout missing after prebuild: "+missing.join(", "));
console.log("student-portal-tabs: tabbed layout verified");

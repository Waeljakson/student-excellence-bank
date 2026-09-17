import {readFileSync,writeFileSync} from "node:fs";

let app=readFileSync("src/App.tsx","utf8");
app=app.replace(
  '["TEACHER","VICE_PRINCIPAL","SUPER_ADMIN"].includes(r))) nav.push(["periodic-evaluations","التقييم الدوري","◎"]);',
  '["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["periodic-evaluations","التقييم الدوري","◎"]);'
);
writeFileSync("src/App.tsx",app);

let periodic=readFileSync("src/PeriodicEvaluationCenter.tsx","utf8");
periodic=periodic.replace(
  '{data?.can_manage&&active&&<section className="panel teacher-progress-panel">',
  '{data?.can_monitor&&active&&<section className="panel teacher-progress-panel">'
);
periodic=periodic.replace(
  '{active&&students.length>0?<section className="panel periodic-board">',
  '{active&&!data?.can_monitor&&students.length>0?<section className="panel periodic-board">'
);
writeFileSync("src/PeriodicEvaluationCenter.tsx",periodic);

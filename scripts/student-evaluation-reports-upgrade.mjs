import { readFileSync, writeFileSync } from "node:fs";

const path="src/App.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('import StudentEvaluationReports from "./StudentEvaluationReports";')){
  const marker='import ReferralCenter from "./ReferralCenter";';
  if(!src.includes(marker)) throw new Error("student-evaluation: ReferralCenter import marker missing");
  src=src.replace(marker,marker+'\nimport StudentEvaluationReports from "./StudentEvaluationReports";');
}

src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"student-evaluations"')?m:m.slice(0,-1)+' | "student-evaluations";');

if(!src.includes('["student-evaluations","تقارير التقييم"')){
  const marker='  nav.push(["account","حسابي","◉"]);';
  if(!src.includes(marker)) throw new Error("student-evaluation: account nav marker missing");
  src=src.replace(marker,'  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.splice(Math.min(4,nav.length),0,["student-evaluations","تقارير التقييم","▤"]);\n'+marker);
}

if(!src.includes('tab==="student-evaluations"&&<StudentEvaluationReports')){
  const marker='{tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>}';
  if(!src.includes(marker)) throw new Error("student-evaluation: referrals render marker missing");
  src=src.replace(marker,marker+' {tab==="student-evaluations"&&<StudentEvaluationReports roles={profile.roles} students={students}/>}');
}

writeFileSync(path,src);

import {readFileSync,writeFileSync} from "node:fs";
let src=readFileSync("src/App.tsx","utf8");
if(!src.includes('import GuardianLogin from "./GuardianLogin";'))src=src.replace('import NotificationCenter from "./NotificationCenter";','import NotificationCenter from "./NotificationCenter";\nimport GuardianLogin from "./GuardianLogin";\nimport GuardianPortal from "./GuardianPortal";\nimport StudentFollowupNotebook from "./StudentFollowupNotebook";\nimport PeriodicEvaluationCenter from "./PeriodicEvaluationCenter";');
src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"followup"')?m:m.slice(0,-1)+' | "followup" | "periodic-evaluations";');
src=src.replace('useState<"otp" | "register" | "password" | "teacher" | "student">("password")','useState<"otp" | "register" | "password" | "teacher" | "student" | "guardian">("password")');
if(!src.includes('>دخول ولي الأمر</button>'))src=src.replace('<button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button>','<button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button><button className={mode==="guardian"?"active":""} onClick={()=>{setMode("guardian");setMessage("")}}>دخول ولي الأمر</button>');
if(!src.includes('mode==="guardian"&&<GuardianLogin'))src=src.replace('{mode==="student"&&<StudentLogin/>}','{mode==="student"&&<StudentLogin/>}\n      {mode==="guardian"&&<GuardianLogin/>}');
if(!src.includes('roles?.includes("GUARDIAN")'))src=src.replace(/if\(profile\.roles\?\.includes\("STUDENT"\)\)return <StudentPortal([^;]+);/,m=>m+'\n  if(profile.roles?.includes("GUARDIAN"))return <GuardianPortal/>;');
const account='  nav.push(["account","حسابي","◉"]);';
if(src.includes(account)&&!src.includes('["followup","دفتر المتابعة"'))src=src.replace(account,'  if(profile.roles?.includes("TEACHER")) nav.push(["followup","دفتر المتابعة","▤"]);\n  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","SUPER_ADMIN"].includes(r))) nav.push(["periodic-evaluations","التقييم الدوري","◎"]);\n'+account);
const evalRender='{tab==="student-evaluations"&&<StudentEvaluationReports roles={profile.roles} students={students}/>}';
if(src.includes(evalRender)&&!src.includes('tab==="followup"&&<StudentFollowupNotebook'))src=src.replace(evalRender,evalRender+' {tab==="followup"&&<StudentFollowupNotebook/>} {tab==="periodic-evaluations"&&<PeriodicEvaluationCenter/>}');
writeFileSync("src/App.tsx",src);

let ev=readFileSync("src/StudentEvaluationReports.tsx","utf8");
if(!ev.includes('async function publishToGuardian'))ev=ev.replace('  function printReport(report: ReportDetail) {','  async function publishToGuardian(report: ReportDetail) {\n    setBusy(`publish:${report.id}`);setMsg("");\n    try{await rpc("api_publish_evaluation_report_to_guardian",{p_report_id:report.id});setMsg("تم إرسال نتيجة التقييم إلى حساب ولي الأمر.");await loadReports();}\n    catch(error){setMsg(niceError(error))}finally{setBusy("")}\n  }\n\n  function printReport(report: ReportDetail) {');
if(!ev.includes('إرسال لولي الأمر</button>'))ev=ev.replace('<button className="btn ghost" onClick={() => printReport(detail)}>طباعة التقرير</button>','<button className="btn primary" disabled={busy===`publish:${detail.id}`} onClick={() => publishToGuardian(detail)}>إرسال لولي الأمر</button>\n                <button className="btn ghost" onClick={() => printReport(detail)}>طباعة التقرير</button>');
writeFileSync("src/StudentEvaluationReports.tsx",ev);

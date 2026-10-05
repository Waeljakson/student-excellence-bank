import {readFileSync,writeFileSync} from "node:fs";

const appPath="src/App.tsx";
let app=readFileSync(appPath,"utf8");

if(!app.includes('import TeacherStudentExitTracker from "./TeacherStudentExitTracker";')){
  const marker='import StudentFollowupNotebook from "./StudentFollowupNotebook";';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: followup import marker missing");
  app=app.replace(marker,marker+'\nimport TeacherStudentExitTracker from "./TeacherStudentExitTracker";');
}
if(!app.includes('import StudentExitAnalytics from "./StudentExitAnalytics";')){
  const marker='import TeacherStudentExitTracker from "./TeacherStudentExitTracker";';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: teacher exit import marker missing");
  app=app.replace(marker,marker+'\nimport StudentExitAnalytics from "./StudentExitAnalytics";');
}

app=app.replace(/type Tab = ([^;]+);/,m=>{
  let out=m;
  if(!out.includes('"student-exits"'))out=out.slice(0,-1)+' | "student-exits";';
  if(!out.includes('"student-exit-analytics"'))out=out.slice(0,-1)+' | "student-exit-analytics";';
  return out;
});

if(!app.includes('["student-exits","استئذان الطلاب","↔"]')){
  const marker='  if(profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["followup","دفتر المتابعة","▤"]);';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: nav marker missing");
  app=app.replace(marker,marker+'\n  if(profile.roles?.includes("TEACHER")) nav.push(["student-exits","استئذان الطلاب","↔"]);');
}
if(!app.includes('["student-exit-analytics","معدلات الخروج","↗"]')){
  const marker='  if(profile.roles?.includes("TEACHER")) nav.push(["student-exits","استئذان الطلاب","↔"]);';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: analytics nav marker missing");
  app=app.replace(marker,marker+'\n  if(profile.roles?.some(r=>["SUPER_ADMIN","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["student-exit-analytics","معدلات الخروج","↗"]);');
}

if(!app.includes('tab==="student-exits"&&<TeacherStudentExitTracker/>')){
  const marker='{tab==="followup"&&<StudentFollowupNotebook roles={profile.roles}/>}';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: render marker missing");
  app=app.replace(marker,marker+' {tab==="student-exits"&&<TeacherStudentExitTracker/>}');
}
if(!app.includes('tab==="student-exit-analytics"&&<StudentExitAnalytics/>')){
  const marker='{tab==="student-exits"&&<TeacherStudentExitTracker/>}';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: analytics render marker missing");
  app=app.replace(marker,marker+' {tab==="student-exit-analytics"&&<StudentExitAnalytics/>}');
}

writeFileSync(appPath,app);

const guardianPath="src/GuardianPortal.tsx";
let guardian=readFileSync(guardianPath,"utf8");

if(!guardian.includes('import GuardianDailyExitStatus from "./GuardianDailyExitStatus";')){
  const marker='import {forceSignOut,neon,niceError,rpc} from "./client";';
  if(!guardian.includes(marker))throw new Error("student-exit-upgrade: guardian import marker missing");
  guardian=guardian.replace(marker,marker+'\nimport GuardianDailyExitStatus from "./GuardianDailyExitStatus";');
}

if(!guardian.includes('<GuardianDailyExitStatus studentId={c.id} studentNo={c.student_no} schoolCode={schoolCode} notes={c.notes||[]}/>')){
  const marker='<DailyFollowup child={c}/>';
  if(!guardian.includes(marker))throw new Error("student-exit-upgrade: daily followup marker missing");
  guardian=guardian.replace(marker,marker+'\n        <GuardianDailyExitStatus studentId={c.id} studentNo={c.student_no} schoolCode={schoolCode} notes={c.notes||[]}/>');
}

writeFileSync(guardianPath,guardian);

console.log("student-exit-upgrade: teacher tracker, admin analytics, and guardian daily exit status wired");

 
// EXIT_NOTE_FILTER_V1
guardian=guardian.replace(
  "  const notes=(child.notes||[]).filter(n=>String(n.note_date||\"\").slice(0,10)===key);",
  "  const notes=(child.notes||[]).filter(n=>!String(n.category_ar||\"\").startsWith(\"استئذان:\")&&!String(n.category_ar||\"\").startsWith(\"الحضور:\")).filter(n=>String(n.note_date||\"\").slice(0,10)===key);"
);
guardian=guardian.replace(
  '<FollowupTimeline notes={c.notes||[]}/>',
  '<FollowupTimeline notes={(c.notes||[]).filter(n=>!String(n.category_ar||"").startsWith("استئذان:")&&!String(n.category_ar||"").startsWith("الحضور:"))}/>'
);
guardian=guardian.replace(
  '<article><span>ملاحظات المتابعة</span><b>{c.notes.length}</b></article>',
  '<article><span>ملاحظات المتابعة</span><b>{(c.notes||[]).filter(n=>!String(n.category_ar||"").startsWith("استئذان:")&&!String(n.category_ar||"").startsWith("الحضور:")).length}</b></article>'
);
writeFileSync(guardianPath,guardian);

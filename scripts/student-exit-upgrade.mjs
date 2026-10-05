import {readFileSync,writeFileSync} from "node:fs";

const appPath="src/App.tsx";
let app=readFileSync(appPath,"utf8");

if(!app.includes('import TeacherStudentExitTracker from "./TeacherStudentExitTracker";')){
  const marker='import StudentFollowupNotebook from "./StudentFollowupNotebook";';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: followup import marker missing");
  app=app.replace(marker,marker+'\nimport TeacherStudentExitTracker from "./TeacherStudentExitTracker";');
}

app=app.replace(/type Tab = ([^;]+);/,m=>{
  if(m.includes('"student-exits"'))return m;
  return m.slice(0,-1)+' | "student-exits";';
});

if(!app.includes('["student-exits","استئذان الطلاب","↔"]')){
  const marker='  if(profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["followup","دفتر المتابعة","▤"]);';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: nav marker missing");
  app=app.replace(marker,marker+'\n  if(profile.roles?.includes("TEACHER")) nav.push(["student-exits","استئذان الطلاب","↔"]);');
}

if(!app.includes('tab==="student-exits"&&<TeacherStudentExitTracker/>')){
  const marker='{tab==="followup"&&<StudentFollowupNotebook roles={profile.roles}/>}';
  if(!app.includes(marker))throw new Error("student-exit-upgrade: render marker missing");
  app=app.replace(marker,marker+' {tab==="student-exits"&&<TeacherStudentExitTracker/>}');
}

writeFileSync(appPath,app);

const guardianPath="src/GuardianPortal.tsx";
let guardian=readFileSync(guardianPath,"utf8");

if(!guardian.includes('import GuardianDailyExitStatus from "./GuardianDailyExitStatus";')){
  const marker='import {forceSignOut,neon,niceError,rpc} from "./client";';
  if(!guardian.includes(marker))throw new Error("student-exit-upgrade: guardian import marker missing");
  guardian=guardian.replace(marker,marker+'\nimport GuardianDailyExitStatus from "./GuardianDailyExitStatus";');
}

if(!guardian.includes('<GuardianDailyExitStatus studentId={c.id} studentNo={c.student_no}/>')){
  const marker='<DailyFollowup child={c}/>';
  if(!guardian.includes(marker))throw new Error("student-exit-upgrade: daily followup marker missing");
  guardian=guardian.replace(marker,marker+'\n        <GuardianDailyExitStatus studentId={c.id} studentNo={c.student_no}/>');
}

writeFileSync(guardianPath,guardian);

console.log("student-exit-upgrade: teacher tracker and guardian daily exit status wired");

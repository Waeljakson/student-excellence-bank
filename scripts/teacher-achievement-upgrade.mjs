import {readFileSync,writeFileSync} from "node:fs";

const path="src/App.tsx";
let s=readFileSync(path,"utf8");

if(!s.includes('import TeacherAchievementStats from "./TeacherAchievementStats";')){
  const marker='import PeriodicEvaluationCenter from "./PeriodicEvaluationCenter";';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: import marker missing");
  s=s.replace(marker,marker+'\nimport TeacherAchievementStats from "./TeacherAchievementStats";');
}

s=s.replace(/type Tab = ([^;]+);/,m=>m.includes('"teacher-stats"')?m:m.slice(0,-1)+' | "teacher-stats";');

if(!s.includes('["teacher-stats",achievementLabel,"▥"]')){
  const marker='  nav.push(["account","حسابي","◉"]);';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: nav marker missing");
  const injection='  const canViewTeacherAchievement=profile.roles?.some(r=>["TEACHER","SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));\n'
    +'  const achievementLabel=profile.roles?.includes("TEACHER")?"إنجازي":"إحصائيات المعلمين";\n'
    +'  if(canViewTeacherAchievement)nav.push(["teacher-stats",achievementLabel,"▥"]);\n'
    +marker;
  s=s.replace(marker,injection);
}

if(!s.includes('tab==="teacher-stats"&&<TeacherAchievementStats')){
  const marker='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: render marker missing");
  s=s.replace(marker,'{tab==="teacher-stats"&&<TeacherAchievementStats roles={profile.roles||[]}/>} '+marker);
}

if(!s.includes('TeacherAchievementStats')||!s.includes('"teacher-stats"')||!s.includes("إحصائيات المعلمين")){
  throw new Error("teacher-achievement-upgrade: patch verification failed");
}

writeFileSync(path,s);
console.log("teacher-achievement-upgrade: teacher ranking dashboard verified");

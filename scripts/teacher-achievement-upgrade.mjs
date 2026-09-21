import {readFileSync,writeFileSync} from "node:fs";

const path="src/App.tsx";
let s=readFileSync(path,"utf8");

if(!s.includes('import TeacherAchievementStats from "./TeacherAchievementStats";')){
  const marker='import PeriodicEvaluationCenter from "./PeriodicEvaluationCenter";';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: import marker missing");
  s=s.replace(marker,marker+'\nimport TeacherAchievementStats from "./TeacherAchievementStats";');
}

if(!s.includes('import TeacherHomeAchievementCard from "./TeacherHomeAchievementCard";')){
  const marker='import TeacherAchievementStats from "./TeacherAchievementStats";';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: home rank import marker missing");
  s=s.replace(marker,marker+'\\nimport TeacherHomeAchievementCard from "./TeacherHomeAchievementCard";');
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

if(s.includes('function DashboardView({ data, checks, isSuperAdmin, onRefresh }: { data: Dashboard|null; checks: Check[]; isSuperAdmin:boolean; onRefresh:()=>void }) {')){
  s=s.replace(
    'function DashboardView({ data, checks, isSuperAdmin, onRefresh }: { data: Dashboard|null; checks: Check[]; isSuperAdmin:boolean; onRefresh:()=>void }) {',
    'function DashboardView({ data, checks, isSuperAdmin, isTeacher, onRefresh, onOpenTeacherStats }: { data: Dashboard|null; checks: Check[]; isSuperAdmin:boolean; isTeacher:boolean; onRefresh:()=>void; onOpenTeacherStats:()=>void }) {'
  );
}
if(!s.includes('<TeacherHomeAchievementCard onOpen={onOpenTeacherStats}/>')){
  const marker='    <section className="stats-grid"><Stat label="الطلاب" value={data.students}/><Stat label="نقاط اليوم" value={data.today_points}/><Stat label="شيكات هذا الشهر" value={data.month_checks}/><Stat label="طلاب حصلوا على تعزيز" value={data.reinforced_students}/></section>';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: dashboard stats marker missing");
  s=s.replace(marker,'    {isTeacher&&<TeacherHomeAchievementCard onOpen={onOpenTeacherStats}/>}\\n'+marker);
}
const oldDashboardCall='{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true} onRefresh={()=>void syncData(["dashboard"],true)}/>}';
const newDashboardCall='{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true} isTeacher={profile.roles?.includes("TEACHER")===true} onRefresh={()=>void syncData(["dashboard"],true)} onOpenTeacherStats={()=>setTab("teacher-stats")}/>}';
if(s.includes(oldDashboardCall))s=s.replace(oldDashboardCall,newDashboardCall);

if(!s.includes('tab==="teacher-stats"&&<TeacherAchievementStats')){
  const marker='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
  if(!s.includes(marker))throw new Error("teacher-achievement-upgrade: render marker missing");
  s=s.replace(marker,'{tab==="teacher-stats"&&<TeacherAchievementStats roles={profile.roles||[]}/>} '+marker);
}

if(!s.includes('TeacherAchievementStats')||!s.includes('TeacherHomeAchievementCard')||!s.includes('"teacher-stats"')||!s.includes("إحصائيات المعلمين")||!s.includes('onOpenTeacherStats')){
  throw new Error("teacher-achievement-upgrade: patch verification failed");
}

writeFileSync(path,s);
console.log("teacher-achievement-upgrade: teacher ranking dashboard verified");

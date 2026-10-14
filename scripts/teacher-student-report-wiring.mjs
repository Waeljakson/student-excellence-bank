import {readFileSync,writeFileSync} from "node:fs";
const patch=function patch(s){
  function addBefore(marker,addition,unique){
    if(s.includes(unique))return;
    if(!s.includes(marker))throw Error("Missing patch marker: "+marker.slice(0,130));
    s=s.replace(marker,addition+marker);
  }
  addBefore('import TeacherAchievementStats from "./TeacherAchievementStats";','import TeacherStudentReport from "./TeacherStudentReport";\n','import TeacherStudentReport from "./TeacherStudentReport";');
  if(!s.includes('"teacher-student-report"')){
    if(!s.includes('type Tab = '))throw Error("Missing Tab type");
    s=s.replace(/type Tab = ([^;]+);/,x=>x.replace(/;$/,' | "teacher-student-report";'));
  }
  addBefore('  nav.push(["account","حسابي","◉"]);',
    '  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["teacher-student-report","تقارير المعلمين","▦"]);\n'+
    '  else if(profile.roles?.includes("TEACHER")) nav.push(["teacher-student-report","تقريري عن الطلاب","▦"]);\n',
    'nav.push(["teacher-student-report"');
  if(!s.includes('function AdminView({pending,users,staff,classes,reload,isSuperAdmin,canManageRoles,onOpenReports}:')){
    const header='function AdminView({pending,users,staff,classes,reload,isSuperAdmin,canManageRoles}:{';
    if(!s.includes(header))throw Error("Missing AdminView signature");
    s=s.replace(header,'function AdminView({pending,users,staff,classes,reload,isSuperAdmin,canManageRoles,onOpenReports}:{');
    const end='canManageRoles:boolean}){';
    if(!s.includes(end))throw Error("Missing AdminView prop types");
    s=s.replace(end,'canManageRoles:boolean;onOpenReports:(teacherId?:string)=>void}){');
  }
  addBefore('    <AddTeacherPanel classes={classes} reload={reload}/>',
    '    <section className="panel tsr-admin-entry"><div className="panel-title"><div><h3>تقارير المعلمين عن الطلاب</h3><p>اختر أي معلم مرتبط بحساب بالمدرسة لإصدار تقرير بكل تحويلاته وملاحظاته وشيكات التميز والتقييمات حسب الطالب أو الفصل.</p></div><button className="btn primary" type="button" onClick={()=>onOpenReports()}>اختيار المعلم وإصدار التقرير</button></div></section>\n',
    'className="panel tsr-admin-entry"');
  addBefore('{isClassScopedJob(s.job_title_ar)&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>',
    '{s.job_title_ar==="معلم"&&s.linked&&s.linked_app_user_id&&<button className="mini-btn" type="button" onClick={()=>onOpenReports(s.linked_app_user_id||undefined)}>إصدار تقرير المعلم</button>}',
    'onOpenReports(s.linked_app_user_id||undefined)');
  addBefore('  const [dashboard,setDashboard]=useState<Dashboard|null>(null);',
    '  const [reportTeacherId,setReportTeacherId]=useState("");\n'+
    '  function openTeacherReport(teacherId?:string){setReportTeacherId(teacherId||"");setTab("teacher-student-report");}\n',
    'function openTeacherReport(teacherId?:string)');
  if(!s.includes('onOpenReports={openTeacherReport}')){
    const marker='canManageRoles={profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))===true}/>';
    if(!s.includes(marker))throw Error("Missing AdminView component call");
    s=s.replace(marker,'canManageRoles={profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))===true} onOpenReports={openTeacherReport}/>');
  }
  addBefore('{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}',
    '{tab==="teacher-student-report"&&<TeacherStudentReport key={reportTeacherId||"select"} initialTeacherId={reportTeacherId} schoolName={schoolName}/>} ',
    'tab==="teacher-student-report"&&<TeacherStudentReport');
  if(!s.includes('nav.push(["teacher-student-report"')||!s.includes('onOpenReports={openTeacherReport}')||!s.includes('tab==="teacher-student-report"&&<TeacherStudentReport')){
    throw Error("Teacher report wiring verification failed");
  }
  return s;
};
const path="src/App.tsx";
const old=readFileSync(path,"utf8");
const modified=patch(old);
if(modified!==old)writeFileSync(path,modified);
console.log("teacher-student-report-wiring: administrator picker and report routes verified");

import {readFileSync,writeFileSync} from "node:fs";

function edit(path,fn){
  let s=readFileSync(path,"utf8");
  const next=fn(s);
  writeFileSync(path,next);
}
function once(s,from,to){return s.includes(to)?s:s.replace(from,to)}

edit("src/App.tsx",s=>{
  s=once(s,
    'import { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";',
    'import { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";\nimport { DEFAULT_SCHOOL_NAME, setCurrentSchoolBrand } from "./school-brand";');
  if(!s.includes("school_name?: string;")){
    s=s.replace('  email?: string;\n  avatar?: string | null;',
      '  email?: string;\n  avatar?: string | null;\n  school_id?: string;\n  school_name?: string;\n  school_code?: string;');
  }
  if(!s.includes("const schoolName=profile.school_name||DEFAULT_SCHOOL_NAME;")){
    s=s.replace(
      '  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>مدارس المشكاة الأهلية</span></div></div>',
      '  const schoolName=profile.school_name||DEFAULT_SCHOOL_NAME;\n  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>{schoolName}</span></div></div>'
    );
  }
  s=s.replace(
    '<div className="main-area"><NotificationCenter/>{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © مدارس المشكاة الأهلية</span></footer></div></div>;',
    '<div className="main-area"><NotificationCenter/>{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © {schoolName}</span></footer></div></div>;'
  );
  s=s.replace(
    'function DashboardView({ data, checks, isSuperAdmin, isTeacher, onRefresh, onOpenTeacherStats }: { data: Dashboard|null; checks: Check[]; isSuperAdmin:boolean; isTeacher:boolean; onRefresh:()=>void; onOpenTeacherStats:()=>void }) {',
    'function DashboardView({ data, checks, schoolName, isSuperAdmin, isTeacher, onRefresh, onOpenTeacherStats }: { data: Dashboard|null; checks: Check[]; schoolName:string; isSuperAdmin:boolean; isTeacher:boolean; onRefresh:()=>void; onOpenTeacherStats:()=>void }) {'
  );
  s=s.replace(
    '<section className="hero"><div><span className="eyebrow">مدارس المشكاة الأهلية</span><h2>التميز يُرى، يُقاس، ويُكافأ.</h2>',
    '<section className="hero"><div><span className="eyebrow">{schoolName}</span><h2>التميز يُرى، يُقاس، ويُكافأ.</h2>'
  );
  if(!s.includes('const schoolName=profile.school_name||DEFAULT_SCHOOL_NAME;\n  useEffect(()=>{setCurrentSchoolBrand')){
    s=s.replace(
      '  const cacheScope="staff:"+(profile.app_user_id||profile.auth_user_id||profile.email||"unknown");',
      '  const schoolName=profile.school_name||DEFAULT_SCHOOL_NAME;\n  useEffect(()=>{setCurrentSchoolBrand(schoolName,profile.school_code)},[schoolName,profile.school_code]);\n  const cacheScope="staff:"+(profile.school_id||profile.school_code||"school")+":"+(profile.app_user_id||profile.auth_user_id||profile.email||"unknown");'
    );
  }
  s=s.replace(
    '<DashboardView data={dashboard} checks={checks} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}',
    '<DashboardView data={dashboard} checks={checks} schoolName={schoolName} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}'
  );
  s=s.replace('<BehavioralExcellence students={students}/>','<BehavioralExcellence students={students} schoolName={schoolName}/>');
  s=s.replace('<StudentEvaluationReports roles={profile.roles} students={students}/>','<StudentEvaluationReports roles={profile.roles} students={students} schoolName={schoolName}/>');
  return s;
});

edit("src/BehavioralExcellence.tsx",s=>{
  s=s.replace('type Props={students:Student[]};','type Props={students:Student[];schoolName?:string};');
  s=s.replace('export default function BehavioralExcellence({students}:Props){','export default function BehavioralExcellence({students,schoolName="مدارس المشكاة الأهلية"}:Props){');
  s=s.replaceAll('متوسطة وثانوية مشكاة الشعلة الأهلية — بنك التميز الطلابي','${esc(schoolName)} — بنك التميز الطلابي');
  return s;
});

edit("src/StudentEvaluationReports.tsx",s=>{
  s=s.replace(
`export default function StudentEvaluationReports({
  roles,
  students,
}: {
  roles: string[];
  students: Student[];
}) {`,
`export default function StudentEvaluationReports({
  roles,
  students,
  schoolName="مدارس المشكاة الأهلية",
}: {
  roles: string[];
  students: Student[];
  schoolName?: string;
}) {`);
  s=s.replaceAll('<div class="school">متوسطة وثانوية مشكاة الشعلة</div>','<div class="school">${esc(schoolName)}</div>');
  return s;
});

edit("src/StudentPortal.tsx",s=>{
  if(!s.includes("school_name?: string;")){
    s=s.replace('type PortalData = {\n  student:',
      'type PortalData = {\n  school_id?: string;\n  school_name?: string;\n  school_code?: string;\n  student:');
  }
  s=s.replace('<div className="student-brand"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>متوسطة وثانوية مشكاة الشعلة</span><h1>بوابة الطالب — بنك التميز</h1></div></div>',
    '<div className="student-brand"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>{data.school_name||"مدارس المشكاة الأهلية"}</span><h1>بوابة الطالب — بنك التميز</h1></div></div>');
  return s;
});

edit("src/GuardianPortal.tsx",s=>{
  s=s.replace('<h2>متوسطة وثانوية مشكاة الشعلة</h2><h1>التقييم الدوري للطالب</h1>',
    '<h2>${esc(data?.school_name||"مدارس المشكاة الأهلية")}</h2><h1>التقييم الدوري للطالب</h1>');
  s=s.replace('<div><span>متوسطة وثانوية مشكاة الشعلة</span><h1>بوابة ولي الأمر</h1>',
    '<div><span>{data?.school_name||"مدارس المشكاة الأهلية"}</span><h1>بوابة ولي الأمر</h1>');
  return s;
});

edit("src/GuardianLogin.tsx",s=>s.replaceAll("متوسطة وثانوية مشكاة الشعلة","مدارس المشكاة الأهلية"));

edit("src/report-print.ts",s=>{
  if(!s.includes('from "./school-brand"'))s='import { getCurrentSchoolName } from "./school-brand";\n'+s;
  if(!s.includes("const schoolName=getCurrentSchoolName();")){
    s=s.replace('  const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});',
      '  const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});\n  const schoolName=getCurrentSchoolName();');
  }
  s=s.replace('<h2>مدارس المشكاة الأهلية — بنك التميز الطلابي</h2>','<h2>${esc(schoolName)} — بنك التميز الطلابي</h2>');
  return s;
});

edit("src/CompetitionManagementPanel.tsx",s=>{
  s=once(s,'import { niceError, rpc } from "./client";','import { niceError, rpc } from "./client";\nimport { getCurrentSchoolName } from "./school-brand";');
  if(!s.includes("const schoolName=getCurrentSchoolName();")){
    s=s.replace('      const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});',
      '      const printedAt=new Date().toLocaleString("ar-SA",{year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});\n      const schoolName=getCurrentSchoolName();');
  }
  s=s.replace('<h2>مدارس المشكاة الأهلية — بنك التميز الطلابي</h2>','<h2>${esc(schoolName)} — بنك التميز الطلابي</h2>');
  return s;
});

edit("src/StaffDirectoryTable.tsx",s=>{
  s=once(s,'import "./staff-directory-table.css";','import "./staff-directory-table.css";\nimport { getCurrentSchoolName } from "./school-brand";');
  s=s.replace('function administration(s: StaffMember) {','function administration(s: StaffMember, schoolName=getCurrentSchoolName()) {');
  s=s.replace('  if (hasMiddle && hasSecondary) return "متوسطة وثانوية مشكاة الشعلة";\n  if (hasSecondary) return "ثانوية مشكاة الشعلة";\n  if (hasMiddle) return "متوسطة مشكاة الشعلة";',
    '  if (hasMiddle && hasSecondary) return schoolName;\n  if (hasSecondary) return schoolName.replace(/^متوسطة وثانوية\\s*/,"ثانوية ");\n  if (hasMiddle) return schoolName.replace(/^متوسطة وثانوية\\s*/,"متوسطة ");');
  s=s.replace('<p>متوسطة وثانوية مشكاة الشعلة</p>','<p>${escapeHtml(getCurrentSchoolName())}</p>');
  return s;
});

edit("src/CompletedReferralsReport.tsx",s=>{
  s=once(s,'import { niceError, rpc } from "./client";','import { niceError, rpc } from "./client";\nimport { getCurrentSchoolName } from "./school-brand";');
  s=s.replace('<div class="school">متوسطة وثانوية مشكاة الشعلة</div>','<div class="school">${esc(getCurrentSchoolName())}</div>');
  s=s.replace('<div class="head"><h1>تحويل طالب</h1><h2>متوسطة وثانوية مشكاة الشعلة</h2>',
    '<div class="head"><h1>تحويل طالب</h1><h2>${esc(getCurrentSchoolName())}</h2>');
  return s;
});

console.log("multi-school branding applied");

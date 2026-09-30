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
  s=s.replace(
    '  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";\n  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";',
    '  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";\n  const studentLocal=email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";\n  const studentNoFromEmail=studentLocal.includes(".")?studentLocal.slice(studentLocal.lastIndexOf(".")+1):studentLocal;\n  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):studentNoFromEmail;'
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


edit("src/StudentLogin.tsx",s=>{
  s=s.replace('import { FormEvent, useState } from "react";','import { FormEvent, useEffect, useState } from "react";');
  if(!s.includes("type SchoolOption="))s=s.replace('type Lookup = { exists: boolean; claimed: boolean };','type Lookup = { exists: boolean; claimed: boolean; school_code?:string; school_name?:string };\ntype SchoolOption={code:string;name_ar:string};');
  s=s.replace('  const [studentNo, setStudentNo] = useState("");\n  const [password, setPassword] = useState("");',
    '  const [studentNo, setStudentNo] = useState("");\n  const [password, setPassword] = useState("");\n  const [schools,setSchools]=useState<SchoolOption[]>([]);\n  const [schoolCode,setSchoolCode]=useState("MISHKAT");');
  if(!s.includes('rpc<SchoolOption[]>("api_public_schools")')){
    s=s.replace('  const [message, setMessage] = useState("");',
      '  const [message, setMessage] = useState("");\n\n  useEffect(()=>{\n    rpc<SchoolOption[]>("api_public_schools").then(rows=>{\n      const list=Array.isArray(rows)?rows:[];\n      setSchools(list);\n      if(list.length&&!list.some(x=>x.code===schoolCode))setSchoolCode(list[0].code);\n    }).catch(()=>{});\n  },[]);');
  }
  s=s.replace('    const email = \`${no}@students.mishkat.sa\`;',
    '    if(!schoolCode){setMessage("اختر المدرسة أولًا.");return;}\n    const email = schoolCode==="MISHKAT"?\`${no}@students.mishkat.sa\`:\`${schoolCode.toLowerCase()}.${no}@students.mishkat.sa\`;');
  s=s.replace('const lookup = await rpc<Lookup>("api_student_lookup", { p_student_no: no });',
    'const lookup = await rpc<Lookup>("api_student_lookup_school", { p_student_no: no, p_school_code: schoolCode });');
  const p='<p>اسم المستخدم هو رقم الطالب. كلمة المرور الافتراضية: رقم الطالب متبوعًا بـ <b>Aa</b>.</p>';
  if(s.includes(p)&&!s.includes('<label>المدرسة<select'))s=s.replace(p,p+'\n    <label>المدرسة<select required value={schoolCode} onChange={e=>setSchoolCode(e.target.value)}>{schools.map(x=><option key={x.code} value={x.code}>{x.name_ar}</option>)}</select></label>');
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

edit("src/GuardianLogin.tsx",s=>{
  s=s.replace('import {FormEvent,useState} from "react";','import {FormEvent,useEffect,useState} from "react";');
  if(!s.includes("type SchoolOption="))s=s.replace('const GUIDANCE_LOGO=\`${import.meta.env.BASE_URL}guidance-logo.png\`;','const GUIDANCE_LOGO=\`${import.meta.env.BASE_URL}guidance-logo.png\`;\ntype SchoolOption={code:string;name_ar:string};');
  s=s.replace('  const[studentNo,setStudentNo]=useState("");\n  const[busy,setBusy]=useState(false);',
    '  const[studentNo,setStudentNo]=useState("");\n  const[schools,setSchools]=useState<SchoolOption[]>([]);\n  const[schoolCode,setSchoolCode]=useState("MISHKAT");\n  const[busy,setBusy]=useState(false);');
  if(!s.includes('rpc<SchoolOption[]>("api_public_schools")')){
    s=s.replace('  const[msg,setMsg]=useState("");',
      '  const[msg,setMsg]=useState("");\n\n  useEffect(()=>{\n    rpc<SchoolOption[]>("api_public_schools").then(rows=>{\n      const list=Array.isArray(rows)?rows:[];\n      setSchools(list);\n      if(list.length&&!list.some(x=>x.code===schoolCode))setSchoolCode(list[0].code);\n    }).catch(()=>{});\n  },[]);');
  }
  s=s.replace('const lookup=await rpc<any>("api_guardian_lookup",{p_mobile:no});',
    'if(!schoolCode)throw new Error("اختر المدرسة أولًا.");\n      const lookup=await rpc<any>("api_guardian_lookup_school",{p_student_no:no,p_school_code:schoolCode});');
  const p='<p>أدخل <b>رقم هوية / رقم الطالب المسجل بالمدرسة</b> فقط. لا تحتاج إلى كلمة مرور.</p>';
  if(s.includes(p)&&!s.includes('<label>المدرسة<select'))s=s.replace(p,p+'\n    <label>المدرسة<select required value={schoolCode} onChange={e=>setSchoolCode(e.target.value)}>{schools.map(x=><option key={x.code} value={x.code}>{x.name_ar}</option>)}</select></label>');
  s=s.replaceAll("متوسطة وثانوية مشكاة الشعلة","مدارس المشكاة الأهلية");
  s=s.replace('الرابط موحّد لجميع أولياء الأمور، وكل ولي أمر يدخل برقم ابنه فقط.','الرابط موحّد لجميع المدارس؛ اختر المدرسة ثم أدخل رقم الطالب المسجل بها.');
  return s;
});

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


edit("src/StudentAddModal.tsx",s=>{
  s=once(s,'import {niceError,rpc} from "./client";','import {niceError,rpc} from "./client";\nimport {getCurrentSchoolCode} from "./school-brand";');
  s=s.replace('const lookup=await rpc<{exists:boolean}>("api_student_lookup",{p_student_no:studentNo.trim()});',
    'const schoolCode=getCurrentSchoolCode();\n      const lookup=await rpc<{exists:boolean}>("api_student_lookup_school",{p_student_no:studentNo.trim(),p_school_code:schoolCode});');
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

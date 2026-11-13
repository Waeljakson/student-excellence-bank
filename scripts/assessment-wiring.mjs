import {readFileSync,writeFileSync} from "node:fs";
function edit(path,fn){const a=readFileSync(path,"utf8"),b=fn(a);if(a!==b){writeFileSync(path,b);console.log("assessment wiring:",path)}}
edit("src/App.tsx",s=>{
 if(!s.includes('import AssessmentAdmin from "./AssessmentAdmin";'))s=s.replace('import PeriodNoticeAdmin from "./PeriodNoticeAdmin";','import PeriodNoticeAdmin from "./PeriodNoticeAdmin";\nimport AssessmentAdmin from "./AssessmentAdmin";');
 if(!s.includes('"assessments-admin"'))s=s.replace(/type Tab = ([^;]+);/,(_,u)=>'type Tab = '+u+' | "assessments-admin";');
 const nav='  nav.push(["account","حسابي","◉"]);';
 if(!s.includes('nav.push(["assessments-admin"'))s=s.replace(nav,'  if(profile.school_code==="MISHKAT"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["assessments-admin","المقاييس والنتائج","◫"]);\n'+nav);
 const view='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
 if(!s.includes('tab==="assessments-admin"'))s=s.replace(view,'{tab==="assessments-admin"&&profile.school_code==="MISHKAT"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<AssessmentAdmin schoolName={schoolName}/>} '+view);
 return s;
});
edit("src/StudentPortal.tsx",s=>{
 if(!s.includes('import AssessmentStudentPanel from "./AssessmentStudentPanel";'))s=s.replace('import PeriodNoticeViewer from "./PeriodNoticeViewer";','import PeriodNoticeViewer from "./PeriodNoticeViewer";\nimport AssessmentStudentPanel from "./AssessmentStudentPanel";');
 s=s.replace('type StudentTab="home"|"competitions"|"rewards"|"medals"|"followup"|"checks"|"announcements"|"period-notices"|"account";',m=>m.includes('"assessments"')?m:m.replace('|"account"','|"assessments"|"account"'));
 if(!s.includes('id:"assessments"'))s=s.replace('         ...(allowsPeriodNotices?[{id:"period-notices" as const,label:"إشعارات النتائج",icon:"▤"}]:[]),','         ...(allowsPeriodNotices?[{id:"period-notices" as const,label:"إشعارات النتائج",icon:"▤"}]:[]),\n    ...(data.school_code==="MISHKAT"?[{id:"assessments" as const,label:"المقاييس",icon:"◫"}]:[]),');
 if(!s.includes('tab==="assessments"&&<AssessmentStudentPanel'))s=s.replace('{tab==="account"&&<section className="portal-panel student-account-panel">','{data.school_code==="MISHKAT"&&tab==="assessments"&&<AssessmentStudentPanel/>}\n{tab==="account"&&<section className="portal-panel student-account-panel">');
 return s;
});
edit("src/GuardianPortal.tsx",s=>{
 if(!s.includes('import {AssessmentResultsInline} from "./AssessmentResultsInline";'))s=s.replace('import {PeriodNoticesInline} from "./PeriodNoticeViewer";','import {PeriodNoticesInline} from "./PeriodNoticeViewer";\nimport {AssessmentResultsInline} from "./AssessmentResultsInline";');
 s=s.replace('useState<"overview"|"medals"|"followup"|"periodic"|"individual"|"competitions"|"period-notices"|"updates">',m=>m.includes('"assessments"')?m:m.replace('|"updates">','|"updates"|"assessments">'));
 if(!s.includes('setTab("assessments")'))s=s.replace('<button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>','<button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>\n          {data.school_code==="MISHKAT"&&<button className={tab==="assessments"?"active":""} onClick={()=>setTab("assessments")}>نتائج المقاييس</button>}');
 if(!s.includes('tab==="assessments"&&<AssessmentResultsInline'))s=s.replace('{tab==="competitions"&&<section className="portal-panel">','{data.school_code==="MISHKAT"&&tab==="assessments"&&<AssessmentResultsInline children={[c]}/>} \n        {tab==="competitions"&&<section className="portal-panel">');
 return s;
});

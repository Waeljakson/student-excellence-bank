import {readFileSync,writeFileSync,existsSync} from "node:fs";

// Project prebuild scripts are idempotent: the source must remain valid and
// stable whether the hook is run once or repeatedly during GitHub Actions.
function update(path, transform){
  if(!existsSync(path))throw Error("Missing file: "+path);
  const before=readFileSync(path,"utf8");
  const after=transform(before);
  if(after!==before){writeFileSync(path,after);console.log("period-notice-wiring updated",path)}
}
function insertOnce(source,content,anchor,where="before"){
  if(source.includes(content))return source;
  if(!source.includes(anchor))throw Error("Period notice wiring anchor missing: "+anchor.slice(0,95));
  return source.replace(anchor,where==="after"?anchor+content:content+anchor);
}

update("src/App.tsx",source=>{
  let s=source;
  s=insertOnce(s,'import PeriodNoticeAdmin from "./PeriodNoticeAdmin";\n',
    'import ExcellencePath from "./ExcellencePath";');
  if(!s.includes('"period-notices-admin"')){
    const anchor=/type Tab = ([^;]+);/;
    if(!anchor.test(s))throw Error("App Tab union not found");
    s=s.replace(anchor,(_,union)=>'type Tab = '+union+' | "period-notices-admin";');
  }
  s=insertOnce(s,
    '  if(profile.school_code==="MISHKAT"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))) nav.push(["period-notices-admin","إشعارات النتائج","▤"]);\n',
    '  nav.push(["account","حسابي","◉"]);');
  s=insertOnce(s,
    '{tab==="period-notices-admin"&&profile.school_code==="MISHKAT"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))&&<PeriodNoticeAdmin schoolName={schoolName}/>} ',
    '{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}',
  );
  if(!s.includes('tab==="period-notices-admin"')||!s.includes('nav.push(["period-notices-admin"'))throw Error("Admin notice navigation incomplete");
  return s;
});

update("src/StudentPortal.tsx",source=>{
  let s=source;
  s=insertOnce(s,'import PeriodNoticeCelebration from "./PeriodNoticeCelebration";\n',
    'import PeriodNoticeViewer from "./PeriodNoticeViewer";');
  s=insertOnce(s,'import PeriodNoticeViewer from "./PeriodNoticeViewer";\n',
    'import StudentFollowupPanel from "./StudentFollowupPanel";');
  if(!s.includes('|"period-notices"|"account"')){
    const anchor='|"account";';
    if(!s.includes(anchor))throw Error('Student tab union missing');
    s=s.replace(anchor,'|"period-notices"|"account";');
  }
  s=insertOnce(s,
    '     ...(allowsPeriodNotices?[{id:"period-notices" as const,label:"إشعارات النتائج",icon:"▤"}]:[]),\n',
    '{id:"account",label:"حسابي",icon:"⚙"}');
  s=insertOnce(s,
    '         {allowsPeriodNotices&&tab==="period-notices"&&<PeriodNoticeViewer schoolName={data.school_name}/>}\n',
    '{tab==="account"&&<section className="portal-panel student-account-panel">');
  s=insertOnce(s,'\n    {allowsPeriodNotices&&<PeriodNoticeCelebration mode="student" loadOwn/>}',
    'return <div className="student-portal">',"after");
  if(!s.includes('tab==="period-notices"')||!s.includes('"period-notices"|"account"'))throw Error("Student portal notice tab wiring incomplete");
  return s;
});

update("src/GuardianPortal.tsx",source=>{
  let s=source;
  s=insertOnce(s,
    'import {PeriodNoticesInline} from "./PeriodNoticeViewer";\n',
    'import MedalsPanel,{MedalCelebrations,type Medal} from "./MedalsPanel";');
  s=insertOnce(s,'import PeriodNoticeCelebration from "./PeriodNoticeCelebration";\n',
    'import {PeriodNoticesInline} from "./PeriodNoticeViewer";');
  s=insertOnce(s,'\n    {allowsPeriodNotices&&<PeriodNoticeCelebration mode="guardian" children={periodNoticeReady?children:[]} guardianScope={String(data.guardian?.id||((data.school_id||"school")+":"+children.map(child=>child.id).sort().join(",")))}/>}',
    'return <div className="guardian-portal">',"after");
  const oldType='"overview"|"medals"|"followup"|"periodic"|"individual"|"competitions">';
  const guardianTabUnion=(s.match(/const\[tab,setTab\]=useState<([^>]+)>/)||[])[1]||"";
  if(!guardianTabUnion.includes('"period-notices"')){
    if(!s.includes(oldType))throw Error("Guardian tab type missing");
    s=s.replace(oldType,'"overview"|"medals"|"followup"|"periodic"|"individual"|"competitions"|"period-notices">');
  }
  s=insertOnce(s,
    '           {allowsPeriodNotices&&<button className={tab==="period-notices"?"active":""} onClick={()=>setTab("period-notices")}>إشعارات النتائج</button>}\n',
    '<button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>');
  s=insertOnce(s,
    '         {allowsPeriodNotices&&tab==="period-notices"&&<section className="portal-panel period-guardian-section"><div className="period-guardian-toolbar"><h3>إشعارات نتائج الفترات</h3><button type="button" className="mini-btn" disabled={periodNoticeLoading} onClick={()=>void refreshPeriodNotices()}>{periodNoticeLoading?"جارٍ تحديث الإشعارات...":"تحديث الإشعارات"}</button></div>{periodNoticeError&&<div className="notice error" role="alert">{periodNoticeError}</div>}{periodNoticeLoading?<p>جارٍ تحميل الإشعارات المنشورة...</p>:<PeriodNoticesInline children={[c]} schoolName={data?.school_name} access={{studentNo:identityMode?c.student_no:undefined,schoolCode:identityMode?(schoolCode||data?.school_code):undefined,token:tokenMode?token:undefined}} />}</section>}\n',
    '{tab==="competitions"&&<section className="portal-panel">');
  if(!s.includes('tab==="period-notices"')||!s.includes('children={[c]}'))throw Error("Guardian portal notice tab wiring incomplete");
  return s;
});

// Smart analytics tabs share this prebuild hook so compiled releases retain them.
update("src/App.tsx",source=>{
 let s=source;
 if(!s.includes('import {SmartDashboard} from "./SmartDashboard";')){
  s=s.replace('import PeriodNoticeAdmin from "./PeriodNoticeAdmin";',
    'import PeriodNoticeAdmin from "./PeriodNoticeAdmin";\nimport {SmartDashboard} from "./SmartDashboard";\nimport OperationalHealth from "./OperationalHealth";\nimport StudentDossierPanel from "./StudentDossierPanel";');
 }
 if(!s.includes('"smart-dashboard"')){
  s=s.replace(/type Tab = ([^;]+);/,(_,v)=>'type Tab = '+v+' | "smart-dashboard" | "student-dossier" | "operational-health";');
 }
 const nav='  nav.push(["account","حسابي","◉"]);';
 const buttons='  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["smart-dashboard","لوحة القيادة الذكية","▥"],["student-dossier","الملف الشامل للطالب","◈"]);\n  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["operational-health","صحة النظام","⛨"]);\n';
 if(!s.includes('nav.push(["smart-dashboard"'))s=s.replace(nav,buttons+nav);
 const view='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
 const insert='{tab==="smart-dashboard"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<SmartDashboard/>} {tab==="student-dossier"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<StudentDossierPanel students={students as unknown as Array<{id:string;name?:string}>}/>} {tab==="operational-health"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<OperationalHealth/>} ';
 if(!s.includes('tab==="smart-dashboard"'))s=s.replace(view,insert+view);
 return s;
});


// Reapply phase 2 navigation after all earlier app upgraders have run.
update("src/App.tsx",source=>{
 let s=source;
 if(!s.includes('import Phase2MessageAdmin from "./Phase2MessageAdmin";'))
  s=s.replace('import PeriodNoticeAdmin from "./PeriodNoticeAdmin";',
    'import PeriodNoticeAdmin from "./PeriodNoticeAdmin";\nimport Phase2MessageAdmin from "./Phase2MessageAdmin";');
 if(!s.includes('"phase2-messages"'))
  s=s.replace(/type Tab = ([^;]+);/,(_,v)=>'type Tab = '+v+' | "phase2-messages";');
 const anchor='  nav.push(["account","حسابي","◉"]);';
 const nav='  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["phase2-messages","مركز الإشعارات والتهاني","✉"]);\n';
 if(!s.includes('nav.push(["phase2-messages"')){if(!s.includes(anchor))throw Error("Phase 2 nav anchor missing");s=s.replace(anchor,nav+anchor)}
 const view='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
 const insert='{tab==="phase2-messages"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<Phase2MessageAdmin/>} ';
 if(!s.includes('tab==="phase2-messages"')){if(!s.includes(view))throw Error("Phase 2 view anchor missing");s=s.replace(view,insert+view)}
 if(!s.includes('<Phase2MessageAdmin/>'))throw Error("Phase 2 admin UI missing");
 return s;
});


// Stage 3: ensure early-support features persist through prebuild transformations.
update("src/App.tsx",source=>{
 let s=source;
 if(!s.includes('import Phase3SupportCenter from "./Phase3SupportCenter";')){
  const anchor='import Phase2MessageAdmin from "./Phase2MessageAdmin";';
  if(!s.includes(anchor))throw Error("Phase 3 import anchor missing");
  s=s.replace(anchor,anchor+'\nimport Phase3SupportCenter from "./Phase3SupportCenter";');
 }
 if(!s.includes('"phase3-support"'))s=s.replace(/type Tab = ([^;]+);/,(_,v)=>'type Tab = '+v+' | "phase3-support";');
 const navAnchor='  nav.push(["account","حسابي","◉"]);';
 const nav='  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["phase3-support","الدعم المبكر للطلاب","✧"]);\n';
 if(!s.includes('nav.push(["phase3-support"')){
  if(!s.includes(navAnchor))throw Error("Phase 3 navigation anchor missing");
  s=s.replace(navAnchor,nav+navAnchor);
 }
 const viewAnchor='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
 const view='{tab==="phase3-support"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))&&<Phase3SupportCenter/>} ';
 if(!s.includes('tab==="phase3-support"')){
  if(!s.includes(viewAnchor))throw Error("Phase 3 view anchor missing");
  s=s.replace(viewAnchor,view+viewAnchor);
 }
 if(!s.includes('<Phase3SupportCenter/>'))throw Error("Phase 3 view is missing after build wiring");
 return s;
});

console.log("period-notice-wiring: admin, student and guardian tabs ready");
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
    '  if(profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))) nav.push(["period-notices-admin","إشعارات النتائج","▤"]);\n',
    '  nav.push(["account","حسابي","◉"]);');
  s=insertOnce(s,
    '{tab==="period-notices-admin"&&profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN"].includes(r))&&<PeriodNoticeAdmin schoolName={schoolName}/>} ',
    '{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}',
  );
  if(!s.includes('tab==="period-notices-admin"')||!s.includes('nav.push(["period-notices-admin"'))throw Error("Admin notice navigation incomplete");
  return s;
});

update("src/StudentPortal.tsx",source=>{
  let s=source;
  s=insertOnce(s,'import PeriodNoticeViewer from "./PeriodNoticeViewer";\n',
    'import StudentFollowupPanel from "./StudentFollowupPanel";');
  if(!s.includes('|"period-notices"|"account"')){
    const anchor='|"account";';
    if(!s.includes(anchor))throw Error('Student tab union missing');
    s=s.replace(anchor,'|"period-notices"|"account";');
  }
  s=insertOnce(s,
    '     {id:"period-notices",label:"إشعارات النتائج",icon:"▤"},\n',
    '     {id:"account",label:"حسابي",icon:"⚙"}');
  s=insertOnce(s,
    '         {tab==="period-notices"&&<PeriodNoticeViewer/>}\n',
    '         {tab==="account"&&<section className="portal-panel student-account-panel">');
  if(!s.includes('tab==="period-notices"')||!s.includes('"period-notices"|"account"'))throw Error("Student portal notice tab wiring incomplete");
  return s;
});

update("src/GuardianPortal.tsx",source=>{
  let s=source;
  s=insertOnce(s,
    'import {PeriodNoticesInline} from "./PeriodNoticeViewer";\n',
    'import MedalsPanel,{MedalCelebrations,type Medal} from "./MedalsPanel";');
  const oldType='"overview"|"medals"|"followup"|"periodic"|"individual"|"competitions">';
  if(!s.includes('"period-notices">')){
    if(!s.includes(oldType))throw Error("Guardian tab type missing");
    s=s.replace(oldType,'"overview"|"medals"|"followup"|"periodic"|"individual"|"competitions"|"period-notices">');
  }
  s=insertOnce(s,
    '           <button className={tab==="period-notices"?"active":""} onClick={()=>setTab("period-notices")}>إشعارات النتائج</button>\n',
    '           <button className={tab==="competitions"?"active":""} onClick={()=>setTab("competitions")}>المسابقات</button>');
  s=insertOnce(s,
    '         {tab==="period-notices"&&<PeriodNoticesInline children={[c]} />}\n',
    '         {tab==="competitions"&&<section className="portal-panel">');
  if(!s.includes('tab==="period-notices"')||!s.includes('children={[c]}'))throw Error("Guardian portal notice tab wiring incomplete");
  return s;
});
console.log("period-notice-wiring: admin, student and guardian tabs ready");
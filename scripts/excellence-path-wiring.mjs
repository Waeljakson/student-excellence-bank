import {readFileSync,writeFileSync} from "node:fs";
const wireExcellencePath=function wireExcellencePath(s){
  const importLine='import ExcellencePath from "./ExcellencePath";';
  if(!s.includes(importLine)){
    const anchor='import TeacherStudentReport from "./TeacherStudentReport";';
    if(!s.includes(anchor))throw Error("Teacher report import missing for Excellence Path wiring");
    s=s.replace(anchor,anchor+'\n'+importLine);
  }
  if(!s.includes('"excellence-path"')){
    const anchor=/type Tab = ([^;]+);/;
    if(!anchor.test(s))throw Error("Tab union missing");
    s=s.replace(anchor,(_,union)=>'type Tab = '+union+' | "excellence-path";');
  }
  if(!s.includes('nav.push(["excellence-path"')){
    const anchor='  nav.push(["account","حسابي","◉"]);';
    if(!s.includes(anchor))throw Error("account nav anchor missing");
    s=s.replace(anchor,'  if(profile.roles?.some(r=>["TEACHER","SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.push(["excellence-path","طريق التفوق","↗"]);\n'+anchor);
  }
  if(!s.includes('tab==="excellence-path"&&<ExcellencePath')){
    const anchor='{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>}';
    if(!s.includes(anchor))throw Error("tab render anchor missing");
    s=s.replace(anchor,'{tab==="excellence-path"&&<ExcellencePath schoolName={schoolName}/>} '+anchor);
  }
  if(!s.includes(importLine)||!s.includes('nav.push(["excellence-path"')||!s.includes('tab==="excellence-path"&&<ExcellencePath'))throw Error("Excellence Path wiring incomplete");
  return s;
};
const path="src/App.tsx";
const original=readFileSync(path,"utf8");
const updated=wireExcellencePath(original);
if(updated!==original)writeFileSync(path,updated);
console.log("excellence-path-wiring: teacher and admin routes ready");

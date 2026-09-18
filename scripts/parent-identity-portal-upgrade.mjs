import {readFileSync,writeFileSync} from "node:fs";

const appPath="src/App.tsx";
let app=readFileSync(appPath,"utf8");
if(!app.includes('const parentPortal=new URLSearchParams(window.location.search).get("parent");')){
  app=app.replace(
    'const guardianToken=new URLSearchParams(window.location.search).get("guardian");',
    'const guardianToken=new URLSearchParams(window.location.search).get("guardian");\n  const parentPortal=new URLSearchParams(window.location.search).get("parent");'
  );
}
if(!app.includes('if(parentPortal)return <GuardianLogin standalone/>;')){
  app=app.replace(
    'if(guardianToken)return <GuardianPortal token={guardianToken}/>;',
    'if(parentPortal)return <GuardianLogin standalone/>;\n  if(guardianToken)return <GuardianPortal token={guardianToken}/>;'
  );
}
if(!app.includes('if(parentPortal)return <GuardianLogin standalone/>;')){
  throw new Error("parent-identity-portal-upgrade: parent public route injection failed");
}
writeFileSync(appPath,app);

const studentPath="src/StudentPortal.tsx";
let student=readFileSync(studentPath,"utf8");
if(!student.includes('import StudentFollowupPanel from "./StudentFollowupPanel";')){
  const marker='import StudentRedemptionPanel from "./StudentRedemptionPanel";';
  if(!student.includes(marker))throw new Error("parent-identity-portal-upgrade: StudentRedemptionPanel import missing");
  student=student.replace(marker,marker+'\nimport StudentFollowupPanel from "./StudentFollowupPanel";');
}
const followupRender='<StudentFollowupPanel notes={data.followup_notes||[]}/>';
if(student.includes('<StudentFollowupPanel/>')) student=student.replace('<StudentFollowupPanel/>',followupRender);
if(!student.includes(followupRender)){
  const marker='<StudentRedemptionPanel/>';
  if(!student.includes(marker))throw new Error("parent-identity-portal-upgrade: StudentRedemptionPanel render missing");
  student=student.replace(marker,marker+'\n      '+followupRender);
}
if(!student.includes('followup_notes: Array<')){
  student=student.replace(
    '  announcements: PortalAnnouncement[];\n};',
    '  announcements: PortalAnnouncement[];\n  followup_notes: Array<{ id:string; subject_ar?:string; note_kind?:string; category_ar?:string; note_text:string; note_date:string; teacher_name?:string }>;\n};'
  );
}
if(!student.includes('Array.isArray(cached.data.portal.followup_notes)')){
  student=student.replace(
    'if(!force&&cached?.data?.portal&&sameCacheVersion(cached.versions,versions,"student_portal")){setData(cached.data.portal as PortalData);return}',
    'if(!force&&cached?.data?.portal&&Array.isArray(cached.data.portal.followup_notes)&&sameCacheVersion(cached.versions,versions,"student_portal")){setData(cached.data.portal as PortalData);return}'
  );
}
if(!student.includes(followupRender)){
  throw new Error("parent-identity-portal-upgrade: student followup panel injection failed");
}
writeFileSync(studentPath,student);

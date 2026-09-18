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
if(!student.includes('<StudentFollowupPanel/>')){
  const marker='<StudentRedemptionPanel/>';
  if(!student.includes(marker))throw new Error("parent-identity-portal-upgrade: StudentRedemptionPanel render missing");
  student=student.replace(marker,marker+'\n      <StudentFollowupPanel/>');
}
if(!student.includes('<StudentFollowupPanel/>')){
  throw new Error("parent-identity-portal-upgrade: student followup panel injection failed");
}
writeFileSync(studentPath,student);

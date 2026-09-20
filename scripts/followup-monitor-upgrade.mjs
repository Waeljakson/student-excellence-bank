import {readFileSync,writeFileSync} from "node:fs";
let src=readFileSync("src/App.tsx","utf8");
src=src.replace(
  'if(profile.roles?.includes("TEACHER")) nav.push(["followup","دفتر المتابعة","▤"]);',
  'if(profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["followup","دفتر المتابعة","▤"]);'
);
writeFileSync("src/App.tsx",src);

let app2=readFileSync("src/App.tsx","utf8");
app2=app2.replace(
  '{tab==="followup"&&<StudentFollowupNotebook/>}',
  '{tab==="followup"&&<StudentFollowupNotebook roles={profile.roles}/>}');
if(!app2.includes('<StudentFollowupNotebook roles={profile.roles}/>')){
  throw new Error("followup-monitor-upgrade: roles were not passed to StudentFollowupNotebook");
}
writeFileSync("src/App.tsx",app2);

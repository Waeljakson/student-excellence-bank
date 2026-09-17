import {readFileSync,writeFileSync} from "node:fs";
let src=readFileSync("src/App.tsx","utf8");
src=src.replace(
  'if(profile.roles?.includes("TEACHER")) nav.push(["followup","دفتر المتابعة","▤"]);',
  'if(profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["followup","دفتر المتابعة","▤"]);'
);
writeFileSync("src/App.tsx",src);

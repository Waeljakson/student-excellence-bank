import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

const oldRepair='try{await rpc("api_claim_student_account",{p_student_no:portalKey});await onRefresh()}';
const newRepair='try{if(portalKey.startsWith("T:")){const mobile=portalKey.slice(2);const lookup=await rpc("api_student_lookup",{p_student_no:portalKey});if(lookup?.job_title==="معلم")await rpc("api_claim_teacher_account",{p_mobile:mobile});else await rpc("api_claim_student_account",{p_student_no:portalKey})}else await rpc("api_claim_student_account",{p_student_no:portalKey});await onRefresh()}';

if(src.includes(oldRepair)){
  src=src.replace(oldRepair,newRepair);
  writeFileSync(appPath,src);
}

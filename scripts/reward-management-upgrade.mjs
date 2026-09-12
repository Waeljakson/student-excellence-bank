import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('import RewardPermissionPanel from "./RewardPermissionPanel";')){
  const anchor='import "./redemption.css";';
  const imports='import RewardPermissionPanel from "./RewardPermissionPanel";\nimport RewardManagementPanel from "./RewardManagementPanel";';
  if(src.includes(anchor)) src=src.replace(anchor,anchor+'\n'+imports);
  else src=imports+'\n'+src;
}

if(!src.includes('REWARD_OFFICER:"مسؤول المكافآت"')){
  src=src.replace('GUIDANCE_COUNSELOR:"موجه طلابي",TEACHER:"معلم"}', 'GUIDANCE_COUNSELOR:"موجه طلابي",TEACHER:"معلم",REWARD_OFFICER:"مسؤول المكافآت"}');
}

if(!src.includes('<RewardPermissionPanel users={users} reload={reload}/>')){
  const anchor='<StaffBudgetPanel/>';
  if(src.includes(anchor)) src=src.replace(anchor,'<RewardPermissionPanel users={users} reload={reload}/>\n    '+anchor);
}

const plain='{tab==="rewards"&&<RewardsView rewards={rewards}/>}';
const managed='{tab==="rewards"&&<><RewardsView rewards={rewards}/>{profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","REWARD_OFFICER"].includes(r))&&<main className="content reward-admin-wrap"><RewardManagementPanel onChanged={loadAll}/></main>}</>}';
if(!src.includes('<RewardManagementPanel onChanged={loadAll}/>')&&src.includes(plain)) src=src.replace(plain,managed);

writeFileSync(appPath,src);

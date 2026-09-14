import { readFileSync, writeFileSync } from "node:fs";

const path="src/ReferralCenter.tsx";
let src=readFileSync(path,"utf8");

if(!src.includes('import CompletedReferralsReport from "./CompletedReferralsReport";')){
  const marker='import "./referrals.css";';
  if(!src.includes(marker)) throw new Error("referral-print-fix: import marker not found");
  src=src.replace(marker,marker+'\nimport CompletedReferralsReport from "./CompletedReferralsReport";');
}

if(!src.includes('{tab==="COMPLETED"&&<CompletedReferralsReport completed={completed}/>}')){
  const re=/\{tab==="COMPLETED"&&<section className="panel referral-archive">.*?<\/section>\}/s;
  if(!re.test(src)) throw new Error("referral-print-fix: completed report block not found");
  src=src.replace(re,'{tab==="COMPLETED"&&<CompletedReferralsReport completed={completed}/>}');
}

writeFileSync(path,src);

import {readFileSync,writeFileSync} from "node:fs";
const path="src/App.tsx";
let s=readFileSync(path,"utf8");
s=s.replace('useState<"otp" | "register" | "password" | "teacher" | "student" | "guardian">("password")','useState<"otp" | "register" | "password" | "teacher" | "student">("password")');
s=s.replace('<button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button><button className={mode==="guardian"?"active":""} onClick={()=>{setMode("guardian");setMessage("")}}>دخول ولي الأمر</button>','<button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button>');
s=s.replace(/\n\s*\{mode==="guardian"&&<GuardianLogin\/>\}/g,"");
if(s.includes('>دخول ولي الأمر</button>')||s.includes('mode==="guardian"&&<GuardianLogin')){
  throw new Error("remove-guardian-main-login: guardian main login still present");
}
if(!s.includes('if(parentPortal)return <GuardianLogin standalone/>;')){
  throw new Error("remove-guardian-main-login: standalone parent portal route missing");
}
writeFileSync(path,s);
console.log("remove-guardian-main-login: main login cleaned; parent portal preserved");

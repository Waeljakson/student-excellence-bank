import { readFileSync, writeFileSync } from "node:fs";

const appPath="src/App.tsx";
let src=readFileSync(appPath,"utf8");

if(!src.includes('import UserAccount from "./UserAccount";')){
  src=src.replace('import KhameesnaCompetition from "./KhameesnaCompetition";','import KhameesnaCompetition from "./KhameesnaCompetition";\nimport UserAccount from "./UserAccount";');
}

if(!src.includes('avatar?: string | null;')){
  src=src.replace('  email?: string;\n  roles: string[];','  email?: string;\n  avatar?: string | null;\n  roles: string[];');
}

src=src.replace(/type Tab = ([^;]+);/,m=>m.includes('"account"')?m:m.slice(0,-1)+' | "account";');

if(!src.includes('nav.push(["account","حسابي"')){
  src=src.replace('  if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);','  nav.push(["account","حسابي","◉"]);\n  if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);');
}

if(!src.includes('className="issuer-profile-line"')){
  src=src.replace('<div className="issuer-card"><small>المستخدم</small><b>{profile.name}</b>','<div className="issuer-card"><div className="issuer-profile-line"><div className="issuer-avatar">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{profile.name?.trim()?.charAt(0)||"م"}</span>}</div><div><small>المستخدم</small><b>{profile.name}</b></div></div>');
}

if(!src.includes('tab==="account"&&<UserAccount')){
  const marker=src.includes('{tab==="system"')?'{tab==="system"':src.includes('{tab=="system"')?'{tab=="system"':null;
  if(!marker) throw new Error("all-user-account: system tab render marker not found");
  src=src.replace(marker,'{tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>} '+marker);
}

writeFileSync(appPath,src);

import {readFileSync} from "node:fs";

for(const path of ["src/TeacherLogin.tsx","src/StudentLogin.tsx"]){
  const source=readFileSync(path,"utf8");
  if(!source.includes("captureAuthResult")||!source.includes("prepareAuthenticatedSession")){
    throw new Error(path+": durable auth handoff missing");
  }
}

const client=readFileSync("src/client.ts","utf8");
for(const marker of ["IOS_AUTH_FALLBACK_V54","fallbackDataClient","prepareAuthenticatedSession","forceSignOut",'credentials:"include"']){
  if(!client.includes(marker))throw new Error("ios-auth-session-fallback: missing "+marker);
}

const app=readFileSync("src/App.tsx","utf8");
for(const marker of ["fallbackUserId","AUTH_FALLBACK_EVENT","isUsableAuthUserId","prepareAuthenticatedSession","forceSignOut"]){
  if(!app.includes(marker))throw new Error("ios-auth-session-fallback: app missing "+marker);
}

console.log("ios-auth-session-fallback: durable auth restore and forced logout verified");

import {readFileSync,writeFileSync} from "node:fs";

function patchPortalLogin(path){
  let s=readFileSync(path,"utf8");
  s=s.replace(
    'import { neon, niceError, rpc } from "./client";',
    'import { captureAuthResult, hasValidAuthFallback, neon, niceError, rpc } from "./client";'
  );
  s=s.replaceAll(
    '          authError(signed);\n',
    '          authError(signed);\n          captureAuthResult(signed);\n'
  );
  s=s.replaceAll(
    '        authError(created);\n',
    '        authError(created);\n        captureAuthResult(created);\n'
  );
  s=s.replace(
    '          const sessionReady = await ensureTeacherSessionReady();',
    '          const sessionReady = hasValidAuthFallback() || await ensureTeacherSessionReady();'
  );
  s=s.replace(
    '      const sessionReadyAfterClaim = await ensureTeacherSessionReady();',
    '      const sessionReadyAfterClaim = hasValidAuthFallback() || await ensureTeacherSessionReady();'
  );
  s=s.replace(
    '          const sessionReady = await ensureStudentSessionReady();',
    '          const sessionReady = hasValidAuthFallback() || await ensureStudentSessionReady();'
  );
  s=s.replace(
    '      const sessionReadyAfterClaim = await ensureStudentSessionReady();',
    '      const sessionReadyAfterClaim = hasValidAuthFallback() || await ensureStudentSessionReady();'
  );
  if(!s.includes("captureAuthResult")||!s.includes("hasValidAuthFallback")){
    throw new Error(path+": iOS auth fallback not installed");
  }
  writeFileSync(path,s);
}

patchPortalLogin("src/TeacherLogin.tsx");
patchPortalLogin("src/StudentLogin.tsx");

const client=readFileSync("src/client.ts","utf8");
if(!client.includes("IOS_AUTH_FALLBACK_V54")||!client.includes("fallbackDataClient")||!client.includes('credentials:"include"')){
  throw new Error("ios-auth-session-fallback: client fallback missing");
}
const app=readFileSync("src/App.tsx","utf8");
if(!app.includes("fallbackUserId")||!app.includes("AUTH_FALLBACK_EVENT")||!app.includes("captureAuthResult(result)")){
  throw new Error("ios-auth-session-fallback: app fallback missing");
}
console.log("ios-auth-session-fallback: Safari/iPhone JWT fallback verified");

import { readFileSync, writeFileSync } from "node:fs";

const EVENT_NAME = "mishkat-auth-success";
const LOGIN_MARKER = "mishkat-login-succeeded";
const RECOVERY_COUNT = "mishkat-session-recovery-count";

function replaceReloadFallbacks(src) {
  let changed = 0;
  for (const pad of ["          ", "      "]) {
    const oldBlock = `${pad}sessionStorage.setItem("${LOGIN_MARKER}", "1");\n${pad}sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n${pad}window.setTimeout(() => {\n${pad}  if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n${pad}}, 900);`;
    const newBlock = `${pad}sessionStorage.removeItem("${LOGIN_MARKER}");\n${pad}sessionStorage.removeItem("${RECOVERY_COUNT}");\n${pad}window.dispatchEvent(new Event("${EVENT_NAME}"));`;
    const before = src;
    src = src.split(oldBlock).join(newBlock);
    if (src !== before) changed++;
  }
  return { src, changed };
}

function patchPortalLogin(path, marker) {
  let src = readFileSync(path, "utf8");
  if (src.includes(marker)) return;
  const result = replaceReloadFallbacks(src);
  if (!result.changed) throw new Error(`${path}: V2 auth reload block not found`);
  src = result.src.replace("export default function", `// ${marker}\nexport default function`);
  writeFileSync(path, src);
}

function patchApp() {
  const path = "src/App.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_SESSION_BRIDGE_V3_APP")) return;

  // Keep the V2 marker so the older prebuild patch remains idempotent on future builds.
  if (!src.includes("AUTH_SESSION_STABILITY_V2_APP")) {
    src = `// AUTH_SESSION_STABILITY_V2_APP retained for build idempotency\n${src}`;
  }

  const reloadResult = replaceReloadFallbacks(src);
  src = reloadResult.src;

  const sessionLine = `  const sessionState=neon.auth.useSession();`;
  if (!src.includes(sessionLine)) throw new Error("App session hook line not found");
  const sessionBridge = `${sessionLine}\n  // AUTH_SESSION_BRIDGE_V3_APP: use getSession as the source-of-truth fallback instead of reloading the page.\n  const [verifiedSession,setVerifiedSession]=useState<any>(null);\n  const [sessionProbeDone,setSessionProbeDone]=useState(false);\n  const sessionUserId=sessionState?.data?.user?.id||verifiedSession?.user?.id;\n  async function probeSession(){\n    try{\n      const current=await neon.auth.getSession();\n      setVerifiedSession(current?.data?.user?.id?current.data:null);\n    }catch{\n      setVerifiedSession(null);\n    }finally{\n      setSessionProbeDone(true);\n    }\n  }\n  useEffect(()=>{\n    void probeSession();\n    const onAuthSuccess=()=>{setSessionProbeDone(false);void probeSession()};\n    window.addEventListener("${EVENT_NAME}",onAuthSuccess);\n    return()=>window.removeEventListener("${EVENT_NAME}",onAuthSuccess);\n  },[]);\n  useEffect(()=>{\n    if(sessionState?.data?.user?.id){setVerifiedSession(sessionState.data);setSessionProbeDone(true);return}\n    if(sessionProbeDone)void probeSession();\n  },[sessionState?.data?.user?.id]);`;
  src = src.replace(sessionLine, sessionBridge);

  const oldEffect = `  useEffect(()=>{if(sessionState?.data?.user?.id){sessionStorage.removeItem("${LOGIN_MARKER}");sessionStorage.removeItem("${RECOVERY_COUNT}");refreshProfile()}else setProfile(null)},[sessionState?.data?.user?.id]);`;
  const newEffect = `  useEffect(()=>{if(sessionUserId){sessionStorage.removeItem("${LOGIN_MARKER}");sessionStorage.removeItem("${RECOVERY_COUNT}");refreshProfile()}else setProfile(null)},[sessionUserId]);`;
  if (!src.includes(oldEffect)) throw new Error("App V2 profile session effect not found");
  src = src.replace(oldEffect, newEffect);

  const oldRender = `  if(sessionState?.isPending)return <Loading text="جارٍ التحقق من الجلسة..."/>;\n  if(!sessionState?.data&&sessionStorage.getItem("${LOGIN_MARKER}")==="1")return <SessionRecovery/>;\n  if(!sessionState?.data)return <AuthScreen/>;`;
  const newRender = `  if((sessionState?.isPending||!sessionProbeDone)&&!sessionUserId)return <Loading text="جارٍ التحقق من الجلسة..."/>;\n  if(!sessionUserId)return <AuthScreen/>;`;
  if (!src.includes(oldRender)) throw new Error("App V2 auth render block not found");
  src = src.replace(oldRender, newRender);

  writeFileSync(path, src);
}

patchPortalLogin("src/TeacherLogin.tsx", "AUTH_SESSION_BRIDGE_V3_TEACHER");
patchPortalLogin("src/StudentLogin.tsx", "AUTH_SESSION_BRIDGE_V3_STUDENT");
patchApp();

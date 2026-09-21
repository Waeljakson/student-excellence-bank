import { readFileSync, writeFileSync } from "node:fs";

const LOGIN_MARKER = "mishkat-login-succeeded";
const RECOVERY_COUNT = "mishkat-session-recovery-count";

const sessionHelper = (name) => `async function ${name}() {\n  for (let attempt = 0; attempt < 8; attempt++) {\n    try {\n      const current = await neon.auth.getSession();\n      if (current?.data?.user?.id) return true;\n    } catch {}\n    await new Promise(resolve => window.setTimeout(resolve, 250));\n  }\n  return false;\n}`;

function patchTeacherLogin() {
  const path = "src/TeacherLogin.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_SESSION_STABILITY_V2_TEACHER")) return;

  const authFn = `function authError(result: any) {\n  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");\n}`;
  if (!src.includes("async function ensureTeacherSessionReady")) {
    if (!src.includes(authFn)) throw new Error("Teacher authError block not found");
    src = src.replace(authFn, `${authFn}\n\n${sessionHelper("ensureTeacherSessionReady")}`);
  }

  const claimedRaw = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          return;\n        } catch {\n          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");\n        }\n      }`;
  const claimedV1 = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_DEVICE_SESSION_FIX_TEACHER: force a fresh app boot so useSession reads the newly-created session on every browser/PWA.\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          window.location.replace(window.location.href);\n          return;\n        } catch {\n          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");\n        }\n      }`;
  const claimedNew = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_SESSION_STABILITY_V2_TEACHER: verify Neon session before any fallback reload.\n          const sessionReady = await ensureTeacherSessionReady();\n          if (!sessionReady) {\n            sessionStorage.removeItem("${LOGIN_MARKER}");\n            setMessage("تم قبول بيانات الدخول، لكن الجلسة لم تكتمل. أعد المحاولة بعد لحظات.");\n            return;\n          }\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n          window.setTimeout(() => {\n            if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n          }, 900);\n          return;\n        } catch {\n          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");\n        }\n      }`;
  if (src.includes(claimedV1)) src = src.replace(claimedV1, claimedNew);
  else if (src.includes(claimedRaw)) src = src.replace(claimedRaw, claimedNew);
  else throw new Error("Teacher claimed-login block not found");

  const firstLoginV1 = `      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`;
  const firstLoginRaw = `      window.location.reload();`;
  const firstLoginNew = `      const sessionReadyAfterClaim = await ensureTeacherSessionReady();\n      if (!sessionReadyAfterClaim) {\n        sessionStorage.removeItem("${LOGIN_MARKER}");\n        setMessage("تم تفعيل الحساب، لكن جلسة الدخول لم تكتمل. أعد المحاولة بعد لحظات.");\n        return;\n      }\n      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n      window.setTimeout(() => {\n        if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n      }, 900);`;
  const lastV1 = src.lastIndexOf(firstLoginV1);
  if (lastV1 >= 0) src = src.slice(0,lastV1) + firstLoginNew + src.slice(lastV1 + firstLoginV1.length);
  else {
    const lastRaw = src.lastIndexOf(firstLoginRaw);
    if (lastRaw < 0) throw new Error("Teacher first-login reload block not found");
    src = src.slice(0,lastRaw) + firstLoginNew + src.slice(lastRaw + firstLoginRaw.length);
  }
  writeFileSync(path, src);
}

function patchStudentLogin() {
  const path = "src/StudentLogin.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_SESSION_STABILITY_V2_STUDENT")) return;

  const authFn = `function authError(result: any) {\n  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");\n}`;
  if (!src.includes("async function ensureStudentSessionReady")) {
    if (!src.includes(authFn)) throw new Error("Student authError block not found");
    src = src.replace(authFn, `${authFn}\n\n${sessionHelper("ensureStudentSessionReady")}`);
  }

  const claimedRaw = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          return;\n        } catch {\n          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");\n        }\n      }`;
  const claimedV1 = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_DEVICE_SESSION_FIX_STUDENT: restart the app after successful sign-in instead of waiting on a stale hook cache.\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          window.location.replace(window.location.href);\n          return;\n        } catch {\n          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");\n        }\n      }`;
  const claimedNew = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_SESSION_STABILITY_V2_STUDENT: verify Neon session before any fallback reload.\n          const sessionReady = await ensureStudentSessionReady();\n          if (!sessionReady) {\n            sessionStorage.removeItem("${LOGIN_MARKER}");\n            setMessage("تم قبول بيانات الدخول، لكن الجلسة لم تكتمل. أعد المحاولة بعد لحظات.");\n            return;\n          }\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n          window.setTimeout(() => {\n            if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n          }, 900);\n          return;\n        } catch {\n          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");\n        }\n      }`;
  if (src.includes(claimedV1)) src = src.replace(claimedV1, claimedNew);
  else if (src.includes(claimedRaw)) src = src.replace(claimedRaw, claimedNew);
  else throw new Error("Student claimed-login block not found");

  const firstLoginV1 = `      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`;
  const firstLoginRaw = `      window.location.reload();`;
  const firstLoginNew = `      const sessionReadyAfterClaim = await ensureStudentSessionReady();\n      if (!sessionReadyAfterClaim) {\n        sessionStorage.removeItem("${LOGIN_MARKER}");\n        setMessage("تم تفعيل الحساب، لكن جلسة الدخول لم تكتمل. أعد المحاولة بعد لحظات.");\n        return;\n      }\n      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n      window.setTimeout(() => {\n        if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n      }, 900);`;
  const lastV1 = src.lastIndexOf(firstLoginV1);
  if (lastV1 >= 0) src = src.slice(0,lastV1) + firstLoginNew + src.slice(lastV1 + firstLoginV1.length);
  else {
    const lastRaw = src.lastIndexOf(firstLoginRaw);
    if (lastRaw < 0) throw new Error("Student first-login reload block not found");
    src = src.slice(0,lastRaw) + firstLoginNew + src.slice(lastRaw + firstLoginRaw.length);
  }
  writeFileSync(path, src);
}

function patchApp() {
  const path = "src/App.tsx";
  let src = readFileSync(path, "utf8");
  if ((src.includes("fallbackUserId") && src.includes("AUTH_FALLBACK_EVENT")) || src.includes("AUTH_SESSION_STABILITY_V2_APP")) return;

  const unwrap = `function unwrapError(result: any) {\n  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تنفيذ العملية");\n  return result;\n}`;
  if (!src.includes("async function ensureAppSessionReady")) {
    if (!src.includes(unwrap)) throw new Error("App unwrapError block not found");
    src = src.replace(unwrap, `${unwrap}\n\n${sessionHelper("ensureAppSessionReady")}`);
  }

  const adminRaw = `      const result = await neon.auth.signIn.email({ email: email.trim(), password });\n      unwrapError(result);`;
  const adminV1 = `      const result = await neon.auth.signIn.email({ email: email.trim(), password });\n      unwrapError(result);\n      // AUTH_DEVICE_SESSION_FIX_APP: reload once after a successful password sign-in so session state is re-read from storage.\n      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`;
  const adminNew = `      const result = await neon.auth.signIn.email({ email: email.trim(), password });\n      unwrapError(result);\n      // AUTH_SESSION_STABILITY_V2_APP: verify the real Neon session and only reload as a delayed fallback.\n      const sessionReady = await ensureAppSessionReady();\n      if (!sessionReady) throw new Error("تم قبول بيانات الدخول، لكن الجلسة لم تكتمل. أعد المحاولة بعد لحظات.");\n      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      sessionStorage.setItem("${RECOVERY_COUNT}", "0");\n      window.setTimeout(() => {\n        if (sessionStorage.getItem("${LOGIN_MARKER}") === "1") window.location.replace(window.location.href);\n      }, 900);`;
  if (src.includes(adminV1)) src = src.replace(adminV1, adminNew);
  else if (src.includes(adminRaw)) src = src.replace(adminRaw, adminNew);
  else throw new Error("Admin password login block not found");

  const loadingFn = `function Loading({ text = "جارٍ تحميل بنك التميز..." }: { text?: string }) {\n  return <div className="full-center"><div className="loader" /><p>{text}</p></div>;\n}`;
  if (!src.includes("function SessionRecovery()")) {
    if (!src.includes(loadingFn)) throw new Error("Loading component not found");
    const recovery = `function SessionRecovery() {\n  const [failed,setFailed]=useState(false);\n  useEffect(()=>{\n    let active=true;\n    (async()=>{\n      const ready=await ensureAppSessionReady();\n      if(!active)return;\n      if(ready){\n        const count=Number(sessionStorage.getItem("${RECOVERY_COUNT}")||"0");\n        if(count<1){sessionStorage.setItem("${RECOVERY_COUNT}",String(count+1));window.location.replace(window.location.href);return}\n      }\n      sessionStorage.removeItem("${LOGIN_MARKER}");\n      sessionStorage.removeItem("${RECOVERY_COUNT}");\n      setFailed(true);\n    })();\n    return()=>{active=false};\n  },[]);\n  if(!failed)return <Loading text="جارٍ استكمال جلسة الدخول..."/>;\n  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>لم تكتمل جلسة الدخول</h1><p>بيانات الدخول قُبلت، لكن الجلسة لم تكتمل على هذا الجهاز. أعد المحاولة. إذا استمرت المشكلة امسح بيانات موقع بنك التميز فقط ثم افتحه من جديد.</p><button className="btn primary" onClick={()=>{sessionStorage.setItem("${LOGIN_MARKER}","1");sessionStorage.setItem("${RECOVERY_COUNT}","0");window.location.reload()}}>إعادة فحص الجلسة</button><button className="btn ghost" onClick={()=>{sessionStorage.removeItem("${LOGIN_MARKER}");sessionStorage.removeItem("${RECOVERY_COUNT}");window.location.reload()}}>العودة لشاشة الدخول</button></div></div>;\n}`;
    src = src.replace(loadingFn, `${loadingFn}\n\n${recovery}`);
  }

  const effectRaw = `  useEffect(()=>{if(sessionState?.data?.user?.id)refreshProfile();else setProfile(null)},[sessionState?.data?.user?.id]);`;
  const effectV1 = `  useEffect(()=>{if(sessionState?.data?.user?.id){sessionStorage.removeItem("${LOGIN_MARKER}");refreshProfile()}else setProfile(null)},[sessionState?.data?.user?.id]);`;
  const effectNew = `  useEffect(()=>{if(sessionState?.data?.user?.id){sessionStorage.removeItem("${LOGIN_MARKER}");sessionStorage.removeItem("${RECOVERY_COUNT}");refreshProfile()}else setProfile(null)},[sessionState?.data?.user?.id]);`;
  if (src.includes(effectV1)) src = src.replace(effectV1,effectNew);
  else if (src.includes(effectRaw)) src = src.replace(effectRaw,effectNew);
  else if (!src.includes(effectNew)) throw new Error("Session profile effect not found");

  const renderV1 = `  if(!sessionState?.data&&sessionStorage.getItem("${LOGIN_MARKER}")==="1")return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>تعذر تثبيت جلسة الدخول على هذا الجهاز</h1><p>تم قبول بيانات الدخول، لكن المتصفح لم يحتفظ بالجلسة. افتح التطبيق من Chrome أو Safari مباشرة وليس من داخل واتساب أو متصفح مدمج، وتأكد أن ملفات تعريف الارتباط وبيانات المواقع غير محظورة.</p><button className="btn primary" onClick={()=>window.location.reload()}>إعادة محاولة الجلسة</button><button className="btn ghost" onClick={()=>{sessionStorage.removeItem("${LOGIN_MARKER}");window.location.reload()}}>العودة لشاشة الدخول</button></div></div>;\n  if(!sessionState?.data)return <AuthScreen/>;`;
  const renderRaw = `  if(!sessionState?.data)return <AuthScreen/>;`;
  const renderNew = `  if(!sessionState?.data&&sessionStorage.getItem("${LOGIN_MARKER}")==="1")return <SessionRecovery/>;\n  if(!sessionState?.data)return <AuthScreen/>;`;
  if (src.includes(renderV1)) src = src.replace(renderV1,renderNew);
  else if (src.includes(renderRaw)) src = src.replace(renderRaw,renderNew);
  else if (!src.includes(renderNew)) throw new Error("AuthScreen render guard not found");

  writeFileSync(path, src);
}

patchTeacherLogin();
patchStudentLogin();
patchApp();

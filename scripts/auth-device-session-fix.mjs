import { readFileSync, writeFileSync } from "node:fs";

const LOGIN_MARKER = "mishkat-login-succeeded";

function patchTeacherLogin() {
  const path = "src/TeacherLogin.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_DEVICE_SESSION_FIX_TEACHER")) return;

  const claimedOld = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          return;\n        } catch {\n          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");\n        }\n      }`;
  const claimedNew = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_DEVICE_SESSION_FIX_TEACHER: force a fresh app boot so useSession reads the newly-created session on every browser/PWA.\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          window.location.replace(window.location.href);\n          return;\n        } catch {\n          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");\n        }\n      }`;
  if (!src.includes(claimedOld)) throw new Error("Teacher claimed-login block not found");
  src = src.replace(claimedOld, claimedNew);

  src = src.replace(
    `      window.location.reload();`,
    `      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`
  );
  writeFileSync(path, src);
}

function patchStudentLogin() {
  const path = "src/StudentLogin.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_DEVICE_SESSION_FIX_STUDENT")) return;

  const claimedOld = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          return;\n        } catch {\n          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");\n        }\n      }`;
  const claimedNew = `      if (lookup.claimed) {\n        try {\n          const signed = await neon.auth.signIn.email({ email, password });\n          authError(signed);\n          // AUTH_DEVICE_SESSION_FIX_STUDENT: restart the app after successful sign-in instead of waiting on a stale hook cache.\n          sessionStorage.setItem("${LOGIN_MARKER}", "1");\n          window.location.replace(window.location.href);\n          return;\n        } catch {\n          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");\n        }\n      }`;
  if (!src.includes(claimedOld)) throw new Error("Student claimed-login block not found");
  src = src.replace(claimedOld, claimedNew);

  src = src.replace(
    `      window.location.reload();`,
    `      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`
  );
  writeFileSync(path, src);
}

function patchApp() {
  const path = "src/App.tsx";
  let src = readFileSync(path, "utf8");
  if (src.includes("AUTH_DEVICE_SESSION_FIX_APP")) return;

  const adminOld = `      const result = await neon.auth.signIn.email({ email: email.trim(), password });\n      unwrapError(result);`;
  const adminNew = `      const result = await neon.auth.signIn.email({ email: email.trim(), password });\n      unwrapError(result);\n      // AUTH_DEVICE_SESSION_FIX_APP: reload once after a successful password sign-in so session state is re-read from storage.\n      sessionStorage.setItem("${LOGIN_MARKER}", "1");\n      window.location.replace(window.location.href);`;
  if (!src.includes(adminOld)) throw new Error("Admin password login block not found");
  src = src.replace(adminOld, adminNew);

  const effectOld = `  useEffect(()=>{if(sessionState?.data?.user?.id)refreshProfile();else setProfile(null)},[sessionState?.data?.user?.id]);`;
  const effectNew = `  useEffect(()=>{if(sessionState?.data?.user?.id){sessionStorage.removeItem("${LOGIN_MARKER}");refreshProfile()}else setProfile(null)},[sessionState?.data?.user?.id]);`;
  if (!src.includes(effectOld)) throw new Error("Session profile effect not found");
  src = src.replace(effectOld, effectNew);

  const renderOld = `  if(!sessionState?.data)return <AuthScreen/>;`;
  const renderNew = `  if(!sessionState?.data&&sessionStorage.getItem("${LOGIN_MARKER}")==="1")return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>تعذر تثبيت جلسة الدخول على هذا الجهاز</h1><p>تم قبول بيانات الدخول، لكن المتصفح لم يحتفظ بالجلسة. افتح التطبيق من Chrome أو Safari مباشرة وليس من داخل واتساب أو متصفح مدمج، وتأكد أن ملفات تعريف الارتباط وبيانات المواقع غير محظورة.</p><button className="btn primary" onClick={()=>window.location.reload()}>إعادة محاولة الجلسة</button><button className="btn ghost" onClick={()=>{sessionStorage.removeItem("${LOGIN_MARKER}");window.location.reload()}}>العودة لشاشة الدخول</button></div></div>;\n  if(!sessionState?.data)return <AuthScreen/>;`;
  if (!src.includes(renderOld)) throw new Error("AuthScreen render guard not found");
  src = src.replace(renderOld, renderNew);
  writeFileSync(path, src);
}

patchTeacherLogin();
patchStudentLogin();
patchApp();

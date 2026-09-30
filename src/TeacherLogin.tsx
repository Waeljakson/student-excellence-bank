import { FormEvent, useEffect, useState } from "react";
import { captureAuthResult, clearLogoutGuard, neon, niceError, prepareAuthenticatedSession, rpc } from "./client";
import { getCurrentSchoolCode } from "./school-brand";
import "./feature-upgrade.css";

type Lookup = { exists: boolean; claimed: boolean; staff_name?:string; job_title?:string; school_code?:string };
type SchoolOption={code:string;name_ar:string};

function authError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");
}

export default function TeacherLogin() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [schools,setSchools]=useState<SchoolOption[]>([]);
  const [schoolCode,setSchoolCode]=useState(()=>getCurrentSchoolCode()||"MISHKAT");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(()=>{
    rpc<SchoolOption[]>("api_public_schools").then(rows=>{
      const list=Array.isArray(rows)?rows:[];
      setSchools(list);
      if(list.length&&!list.some(x=>x.code===schoolCode))setSchoolCode(list[0].code);
    }).catch(()=>{});
  },[]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const phone = mobile.trim();
    if (!/^05\d{8}$/.test(phone)) { setMessage("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05."); return; }
    if(!schoolCode){setMessage("اختر المدرسة أولًا.");return;}
    const email = schoolCode==="MISHKAT" ? phone+"@staff.mishkat.sa" : schoolCode.toLowerCase()+"."+phone+"@staff.mishkat.sa";
    setBusy(true);
    setMessage("");
    try {
      const lookup = await rpc<Lookup>("api_staff_lookup_school", { p_mobile: phone, p_school_code: schoolCode });
      if (!lookup.exists) throw new Error("رقم المستخدم غير موجود ضمن الهيئة المسجلة في النظام.");

      if (lookup.claimed) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          clearLogoutGuard();
          captureAuthResult(signed);
          if(!await prepareAuthenticatedSession(8))throw new Error("AUTH_REQUIRED");
          window.dispatchEvent(new Event("mishkat-auth-success"));
          window.location.reload();
          return;
        } catch {
          throw new Error("رقم المستخدم أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");
        }
      }

      if (password !== `${phone}Aa`) throw new Error("كلمة المرور غير صحيحة. يرجى مراجعة إدارة النظام.");

      let ready = false;
      try {
        const created = await neon.auth.signUp.email({ name: lookup.staff_name || "موظف", email, password });
        authError(created);
        clearLogoutGuard();
        captureAuthResult(created);
        ready = true;
      } catch (createErr) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          clearLogoutGuard();
          captureAuthResult(signed);
          ready = true;
        } catch {
          throw createErr;
        }
      }

      if (!ready) throw new Error("تعذر تفعيل حساب الهيئة.");
      try {
        const signed = await neon.auth.signIn.email({ email, password });
        authError(signed);
        clearLogoutGuard();
        captureAuthResult(signed);
      } catch {
        // signUp قد ينشئ الجلسة تلقائيًا.
      }

      if(!await prepareAuthenticatedSession(8))throw new Error("AUTH_REQUIRED");

      await rpc("api_claim_staff_account_school", { p_mobile: phone, p_school_code: schoolCode });
      window.dispatchEvent(new Event("mishkat-auth-success"));
      window.location.reload();
    } catch (err) {
      setMessage(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack student-login-form">
    <h2>دخول الهيئة التعليمية</h2>
    <p>للمعلم والوكيل والموجه والمدير. اسم المستخدم هو رقم الجوال، وكلمة المرور الافتراضية رقم الجوال متبوعًا بـ Aa.</p>
    <label>المدرسة<select required value={schoolCode} onChange={e=>setSchoolCode(e.target.value)}>{schools.map(x=><option key={x.code} value={x.code}>{x.name_ar}</option>)}</select></label>
    <label>رقم الجوال<input inputMode="numeric" autoComplete="username" required value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="05xxxxxxxx"/></label>
    <label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور"/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول الهيئة"}</button>
    {message&&<div className="notice">{message}</div>}
  </form>;
}

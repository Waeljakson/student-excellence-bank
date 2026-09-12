import { FormEvent, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";

type Lookup = { exists: boolean; claimed: boolean };

function authError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");
}

export default function TeacherLogin() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const phone = mobile.trim();
    if (!/^\d+$/.test(phone)) { setMessage("اكتب رقم الجوال المسجل في دليل الهيئة."); return; }
    const email = `${phone}@staff.mishkat.sa`;
    setBusy(true);
    setMessage("");
    try {
      // نستخدم RPC قديمًا وموجودًا بالفعل في Data API لتجنب مشكلة schema cache.
      const teacherKey = `T:${phone}`;
      const lookup = await rpc<Lookup>("api_student_lookup", { p_student_no: teacherKey });
      if (!lookup.exists) throw new Error("رقم الجوال غير موجود ضمن المعلمين المسجلين في دليل الهيئة.");

      if (lookup.claimed) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          return;
        } catch {
          throw new Error("رقم الجوال أو كلمة المرور غير صحيحة.");
        }
      }

      if (password !== `${phone}Aa`) throw new Error("كلمة المرور الافتراضية غير صحيحة. استخدم رقم الجوال متبوعًا بـ Aa.");

      let ready = false;
      try {
        const created = await neon.auth.signUp.email({ name: "معلم", email, password });
        authError(created);
        ready = true;
      } catch (createErr) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          ready = true;
        } catch {
          throw createErr;
        }
      }

      if (!ready) throw new Error("تعذر تفعيل حساب المعلم.");
      try {
        const signed = await neon.auth.signIn.email({ email, password });
        authError(signed);
      } catch {
        // signUp قد ينشئ الجلسة تلقائيًا.
      }

      // نفس RPC القديم يقوم بربط حساب المعلم عندما يبدأ المفتاح بـ T:.
      await rpc("api_claim_student_account", { p_student_no: teacherKey });
      window.location.reload();
    } catch (err) {
      setMessage(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack student-login-form">
    <h2>دخول المعلم</h2>
    <p>اسم المستخدم هو رقم الجوال المسجل في دليل الهيئة. كلمة المرور الافتراضية: رقم الجوال متبوعًا بـ <b>Aa</b>.</p>
    <label>رقم الجوال<input inputMode="numeric" autoComplete="username" required value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="05xxxxxxxx"/></label>
    <label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="رقم الجوال + Aa"/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول المعلم"}</button>
    {message&&<div className="notice">{message}</div>}
  </form>;
}

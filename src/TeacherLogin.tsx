import { FormEvent, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";

type Lookup = { exists: boolean; claimed: boolean; staff_name?:string; job_title?:string };

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
      const staffKey = `T:${phone}`;
      const lookup = await rpc<Lookup>("api_student_lookup", { p_student_no: staffKey });
      if (!lookup.exists) throw new Error("رقم الجوال غير موجود ضمن الهيئة المسجلة في النظام.");

      if (lookup.claimed) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          return;
        } catch {
          throw new Error("رقم الجوال أو كلمة المرور غير صحيحة، أو أن هذا الموظف مرتبط بحساب إدارة مختلف.");
        }
      }

      if (password !== `${phone}Aa`) throw new Error("كلمة المرور الافتراضية غير صحيحة. استخدم رقم الجوال متبوعًا بـ Aa.");

      let ready = false;
      try {
        const created = await neon.auth.signUp.email({ name: lookup.staff_name || "موظف", email, password });
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

      if (!ready) throw new Error("تعذر تفعيل حساب الهيئة.");
      try {
        const signed = await neon.auth.signIn.email({ email, password });
        authError(signed);
      } catch {
        // signUp قد ينشئ الجلسة تلقائيًا.
      }

      if (lookup.job_title === "معلم") {
        await rpc("api_claim_teacher_account", { p_mobile: phone });
      } else {
        await rpc("api_claim_student_account", { p_student_no: staffKey });
      }
      window.location.reload();
    } catch (err) {
      setMessage(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack student-login-form">
    <h2>دخول الهيئة التعليمية</h2>
    <p>للمعلم والوكيل والموجه والمدير. اسم المستخدم هو رقم الجوال المسجل في دليل الهيئة، وكلمة المرور الافتراضية: رقم الجوال متبوعًا بـ <b>Aa</b>.</p>
    <label>رقم الجوال<input inputMode="numeric" autoComplete="username" required value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="05xxxxxxxx"/></label>
    <label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="رقم الجوال + Aa"/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول الهيئة"}</button>
    {message&&<div className="notice">{message}</div>}
  </form>;
}

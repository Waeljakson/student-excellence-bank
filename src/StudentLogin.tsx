import { FormEvent, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";

type Lookup = { exists: boolean; claimed: boolean };

function authError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");
}

export default function StudentLogin() {
  const [studentNo, setStudentNo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const no = studentNo.trim();
    if (!/^\d+$/.test(no)) { setMessage("اكتب رقم الطالب كما هو في المدرسة."); return; }
    const email = `${no}@students.mishkat.sa`;
    setBusy(true); setMessage("");
    try {
      const signed = await neon.auth.signIn.email({ email, password });
      if (!signed?.error) return;

      const lookup = await rpc<Lookup>("api_student_lookup", { p_student_no: no });
      if (!lookup.exists) throw new Error("رقم الطالب غير موجود في قاعدة المدرسة.");
      if (lookup.claimed) throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");
      if (password !== `${no}Aa`) throw new Error("كلمة المرور الافتراضية غير صحيحة.");

      const created = await neon.auth.signUp.email({ name: `طالب ${no}`, email, password });
      authError(created);
      const again = await neon.auth.signIn.email({ email, password });
      if (again?.error && !created?.data) authError(again);
      await rpc("api_claim_student_account", { p_student_no: no });
      window.location.reload();
    } catch (err) {
      setMessage(niceError(err));
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="form-stack student-login-form">
    <h2>دخول الطالب</h2>
    <p>اسم المستخدم هو رقم الطالب. كلمة المرور الافتراضية: رقم الطالب متبوعًا بـ <b>Aa</b>.</p>
    <label>رقم الطالب<input inputMode="numeric" autoComplete="username" required value={studentNo} onChange={e=>setStudentNo(e.target.value)} placeholder="رقم الطالب"/></label>
    <label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="رقم الطالب + Aa"/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول الطالب"}</button>
    {message&&<div className="notice">{message}</div>}
  </form>;
}

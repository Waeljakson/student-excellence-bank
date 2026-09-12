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
    setBusy(true);
    setMessage("");

    try {
      // نتحقق من سجل الطالب أولًا بدل محاولة تسجيل دخول لحساب لم يُنشأ بعد.
      const lookup = await rpc<Lookup>("api_student_lookup", { p_student_no: no });
      if (!lookup.exists) throw new Error("رقم الطالب غير موجود في قاعدة المدرسة.");

      // الطالب المرتبط سابقًا: دخول عادي بنفس رقم الطالب وكلمة المرور.
      if (lookup.claimed) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          return;
        } catch {
          throw new Error("رقم الطالب أو كلمة المرور غير صحيحة.");
        }
      }

      // أول دخول: كلمة المرور الابتدائية ثابتة حسب طلب المدرسة.
      if (password !== `${no}Aa`) throw new Error("كلمة المرور الافتراضية غير صحيحة. استخدم رقم الطالب متبوعًا بـ Aa.");

      // إنشاء حساب Neon Auth لأول مرة. إذا وُجد حساب Auth يتيم سابقًا نحاول الدخول به.
      let createdOk = false;
      try {
        const created = await neon.auth.signUp.email({ name: `طالب ${no}`, email, password });
        authError(created);
        createdOk = true;
      } catch (createErr) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          createdOk = true;
        } catch {
          throw createErr;
        }
      }

      if (!createdOk) throw new Error("تعذر إنشاء حساب الطالب.");

      // نتأكد أن جلسة الطالب فعالة ثم نربطها بسجل الطالب الموجود، دون إنشاء طالب جديد.
      try {
        const signed = await neon.auth.signIn.email({ email, password });
        authError(signed);
      } catch {
        // signUp في Neon Auth قد يسجل الدخول تلقائيًا؛ نكمل محاولة الربط في هذه الحالة.
      }

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

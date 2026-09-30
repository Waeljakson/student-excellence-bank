import { FormEvent, useEffect, useState } from "react";
import { captureAuthResult, neon, niceError, prepareAuthenticatedSession, rpc } from "./client";
import "./feature-upgrade.css";

type Lookup = { exists: boolean; claimed: boolean; school_code?:string; school_name?:string };
type SchoolOption={code:string;name_ar:string};

function authError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تسجيل الدخول");
}

export default function StudentLogin() {
  const [studentNo, setStudentNo] = useState("");
  const [password, setPassword] = useState("");
  const [schools,setSchools]=useState<SchoolOption[]>([]);
  const [schoolCode,setSchoolCode]=useState("MISHKAT");
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
    const no = studentNo.trim();
    if (!/^\d+$/.test(no)) { setMessage("اكتب رقم الطالب كما هو في المدرسة."); return; }

    if(!schoolCode){setMessage("اختر المدرسة أولًا.");return;}
    const email = schoolCode==="MISHKAT"?`${no}@students.mishkat.sa`:`${schoolCode.toLowerCase()}.${no}@students.mishkat.sa`;
    setBusy(true);
    setMessage("");

    try {
      // نتحقق من سجل الطالب أولًا بدل محاولة تسجيل دخول لحساب لم يُنشأ بعد.
      const lookup = await rpc<Lookup>("api_student_lookup_school", { p_student_no: no, p_school_code: schoolCode });
      if (!lookup.exists) throw new Error("رقم الطالب غير موجود في قاعدة المدرسة.");

      // الطالب المرتبط سابقًا: دخول عادي بنفس رقم الطالب وكلمة المرور.
      if (lookup.claimed) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          captureAuthResult(signed);
          if(!await prepareAuthenticatedSession(8))throw new Error("AUTH_REQUIRED");
          window.dispatchEvent(new Event("mishkat-auth-success"));
          window.dispatchEvent(new Event("mishkat-auth-success"));
      window.location.reload();
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
        captureAuthResult(created);
        createdOk = true;
      } catch (createErr) {
        try {
          const signed = await neon.auth.signIn.email({ email, password });
          authError(signed);
          captureAuthResult(signed);
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
        captureAuthResult(signed);
      } catch {
        // signUp في Neon Auth قد يسجل الدخول تلقائيًا؛ نكمل محاولة الربط في هذه الحالة.
      }

      if(!await prepareAuthenticatedSession(8))throw new Error("AUTH_REQUIRED");
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
    <label>المدرسة<select required value={schoolCode} onChange={e=>setSchoolCode(e.target.value)}>{schools.map(x=><option key={x.code} value={x.code}>{x.name_ar}</option>)}</select></label>
    <label>رقم الطالب<input inputMode="numeric" autoComplete="username" required value={studentNo} onChange={e=>setStudentNo(e.target.value)} placeholder="رقم الطالب"/></label>
    <label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="رقم الطالب + Aa"/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول الطالب"}</button>
    {message&&<div className="notice">{message}</div>}
  </form>;
}

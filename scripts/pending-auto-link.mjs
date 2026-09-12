import { readFileSync, writeFileSync } from "node:fs";

const appPath = "src/App.tsx";
let src = readFileSync(appPath, "utf8");

if (!src.includes("AUTO_PORTAL_ACCOUNT_LINK")) {
  const current = `function PendingAccount({ profile }: { profile: Profile; onRefresh: ()=>void }) {
  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>الحساب غير مرتبط بالنظام</h1><p>{profile.name || profile.email} — استخدم طريقة الدخول المخصصة لك. المعلم يدخل برقم الجوال، والطالب برقم الطالب.</p><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
}`;

  const upgraded = `function PendingAccount({ profile, onRefresh }: { profile: Profile; onRefresh: ()=>void }) {
  // AUTO_PORTAL_ACCOUNT_LINK
  const [busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  const email=String(profile.email||"").trim().toLowerCase();
  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";
  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";
  async function repair(){if(!portalKey||busy)return;setBusy(true);setMessage("");try{await rpc("api_claim_student_account",{p_student_no:portalKey});await onRefresh()}catch(e){setMessage(niceError(e))}finally{setBusy(false)}}
  useEffect(()=>{if(portalKey)void repair()},[portalKey]);
  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">{busy?"⏳":"!"}</span><h1>{busy?"جارٍ ربط الحساب بالنظام":"الحساب غير مرتبط بالنظام"}</h1><p>{busy?"يتم الآن إكمال ربط حسابك تلقائيًا ببيانات المدرسة.":profile.name||profile.email}</p>{message&&<div className="notice error">{message}</div>}{portalKey&&<button className="btn primary" disabled={busy} onClick={repair}>{busy?"جارٍ الربط...":"إعادة محاولة ربط الحساب"}</button>}<button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
}`;

  if (!src.includes(current)) {
    throw new Error("PendingAccount pattern not found for auto-link upgrade");
  }

  src = src.replace(current, upgraded);
  writeFileSync(appPath, src);
}

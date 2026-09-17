// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
// SYSTEM_FEATURES_V2
import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AUTH_URL, neon, niceError, rpc } from "./client";
import StudentExcelImporter from "./StudentExcelImporter";
import StudentLogin from "./StudentLogin";
import TeacherLogin from "./TeacherLogin";
import AdminPasswordReset from "./AdminPasswordReset";
import StudentPortal from "./StudentPortal";
import SystemControlPanel from "./SystemControlPanel";
import KhameesnaCompetition from "./KhameesnaCompetition";
import UserAccount from "./UserAccount";
import ReferralCenter from "./ReferralCenter";
import StudentEvaluationReports from "./StudentEvaluationReports";
import BehavioralExcellence from "./BehavioralExcellence";
import StaffBudgetPanel from "./StaffBudgetPanel";
import GuidanceRedemptionCenter from "./GuidanceRedemptionCenter";
import TeacherCheckManager from "./TeacherCheckManager";
import "./redemption.css";
import RewardPermissionPanel from "./RewardPermissionPanel";
import RewardManagementPanel from "./RewardManagementPanel";
import AddTeacherPanel from "./AddTeacherPanel";
import StaffDirectoryTable from "./StaffDirectoryTable";
import StudentClassEditor from "./StudentClassEditor";
import StudentMobileEditor from "./StudentMobileEditor";
import NotificationCenter from "./NotificationCenter";
import GuardianLogin from "./GuardianLogin";
import GuardianPortal from "./GuardianPortal";
import StudentFollowupNotebook from "./StudentFollowupNotebook";
import PeriodicEvaluationCenter from "./PeriodicEvaluationCenter";
import { readDataCache, writeDataCache, sameCacheVersion, type CacheVersions } from "./data-cache";

type Profile = {
  status: "PENDING" | "APPROVED" | "DISABLED";
  app_user_id?: string;
  auth_user_id?: string;
  name?: string;
  email?: string;
  avatar?: string | null;
  roles: string[];
  can_issue: boolean;
  monthly_limit?: number | null;
  is_unlimited?: boolean;
  used_this_month?: number;
  remaining?: number | null;
};

type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; class_id?: string; points: number; value_sar: number; level: string };
type Rule = { id: string; name_ar: string; description_ar?: string; default_points: number; min_points: number; max_points: number; is_mega: boolean; category_name?: string };
type Check = { id: string; serial_no: string; points: number; reason_ar?: string; reason?: string; status: string; approval_status: string; qr_nonce: string; issued_at: string; student_name: string; issuer_name?: string };
type Dashboard = { students: number; today_points: number; month_checks: number; reinforced_students: number; point_value_sar: number };
type Rankings = { students: Array<{ id: string; name: string; grade_name: string; class_name: string; points: number }>; classes: Array<{ id: string; grade_name: string; class_name: string; student_count: number; total_points: number; average_points: number }> };
type PendingUser = { auth_user_id: string; name: string; email: string; created_at: string };
type ManagedUser = { id: string; auth_user_id: string; name: string; email: string; is_active: boolean; roles: string[]; monthly_limit: number | null; is_unlimited: boolean; staff_id?: string | null; job_title_ar?: string | null; assigned_class_ids: string[]; assigned_classes: string[] };
type StaffMember = { id: string; employee_no?: string | null; full_name_ar: string; nationality_ar?: string | null; job_title_ar: string; specialty_ar?: string | null; teaching_subject_ar?: string | null; mobile?: string | null; linked_app_user_id?: string | null; linked: boolean; assigned_class_ids: string[]; assigned_classes: string[] };
type AdminClass = { id: string; grade_name: string; class_name: string };
type Reward = { id: string; name_ar: string; description_ar?: string; cost_points: number; cash_value_sar?: number; stock?: number };
type KhameesnaStanding = { class_id: string; grade_name: string; class_name: string; total_points: number; awards_count: number; last_award?: string };
type KhameesnaRecent = { id: string; points: number; lesson_no: number; subject_ar?: string; reason_ar?: string; lesson_date: string; awarded_at: string; class_name: string; grade_name: string; teacher_name: string };
type KhameesnaHistory = { week_start: string; class_id: string; grade_name: string; class_name: string; total_points: number };
type KhameesnaBoard = { week_start: string; week_end: string; status: "IN_PROGRESS" | "THURSDAY" | "CLOSED"; reward: string; max_points: number; leader_count: number; allowed_classes: Array<{class_id:string;grade_name:string;class_name:string}>; standings: KhameesnaStanding[]; recent: KhameesnaRecent[]; history: KhameesnaHistory[] };

type Tab = "dashboard" | "checks" | "khameesna" | "students" | "rankings" | "rewards" | "admin" | "system" | "account" | "referrals" | "behavioral" | "redemption" | "student-evaluations" | "followup" | "periodic-evaluations";

const BASE_URL = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

// ROLE_SCOPE_V2
const CLASS_SCOPED_JOBS = ["معلم", "مدير المدرسة", "وكيل المدرسة", "الموجه الطلابي"];
function isClassScopedJob(job?: string | null) { return !!job && CLASS_SCOPED_JOBS.includes(job); }

function unwrapError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تنفيذ العملية");
  return result;
}

async function ensureAppSessionReady() {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const current = await neon.auth.getSession();
      if (current?.data?.user?.id) return true;
    } catch {}
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  return false;
}

function Loading({ text = "جارٍ تحميل بنك التميز..." }: { text?: string }) {
  return <div className="full-center"><div className="loader" /><p>{text}</p></div>;
}

function SessionRecovery() {
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    (async()=>{
      const ready=await ensureAppSessionReady();
      if(!active)return;
      if(ready){
        const count=Number(sessionStorage.getItem("mishkat-session-recovery-count")||"0");
        if(count<1){sessionStorage.setItem("mishkat-session-recovery-count",String(count+1));window.location.replace(window.location.href);return}
      }
      sessionStorage.removeItem("mishkat-login-succeeded");
      sessionStorage.removeItem("mishkat-session-recovery-count");
      setFailed(true);
    })();
    return()=>{active=false};
  },[]);
  if(!failed)return <Loading text="جارٍ استكمال جلسة الدخول..."/>;
  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">!</span><h1>لم تكتمل جلسة الدخول</h1><p>بيانات الدخول قُبلت، لكن الجلسة لم تكتمل على هذا الجهاز. أعد المحاولة. إذا استمرت المشكلة امسح بيانات موقع بنك التميز فقط ثم افتحه من جديد.</p><button className="btn primary" onClick={()=>{sessionStorage.setItem("mishkat-login-succeeded","1");sessionStorage.setItem("mishkat-session-recovery-count","0");window.location.reload()}}>إعادة فحص الجلسة</button><button className="btn ghost" onClick={()=>{sessionStorage.removeItem("mishkat-login-succeeded");sessionStorage.removeItem("mishkat-session-recovery-count");window.location.reload()}}>العودة لشاشة الدخول</button></div></div>;
}

function AuthScreen() {
  const [mode, setMode] = useState<"otp" | "register" | "password" | "teacher" | "student" | "guardian">("password");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendOtp(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await neon.auth.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
      unwrapError(result); setOtpSent(true); setMessage("تم إرسال رمز الدخول إلى بريدك الإلكتروني.");
    } catch (e) { setMessage(niceError(e)); } finally { setBusy(false); }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await neon.auth.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
      unwrapError(result); setMessage("تم تسجيل الدخول.");
    } catch (e) { setMessage(niceError(e)); } finally { setBusy(false); }
  }

  async function register(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await neon.auth.signUp.email({ name: name.trim(), email: email.trim(), password });
      unwrapError(result); setMessage("تم إنشاء الحساب. بعد الدخول سيظهر طلبك للإدارة لاعتماد صلاحية المعلم.");
    } catch (e) { setMessage(niceError(e)); } finally { setBusy(false); }
  }

  async function passwordLogin(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await neon.auth.signIn.email({ email: email.trim(), password });
      unwrapError(result);
      // AUTH_SESSION_STABILITY_V2_APP: verify the real Neon session and only reload as a delayed fallback.
      const sessionReady = await ensureAppSessionReady();
      if (!sessionReady) throw new Error("تم قبول بيانات الدخول، لكن الجلسة لم تكتمل. أعد المحاولة بعد لحظات.");
      sessionStorage.removeItem("mishkat-login-succeeded");
      sessionStorage.removeItem("mishkat-session-recovery-count");
      window.dispatchEvent(new Event("mishkat-auth-success"));
    } catch (e) { setMessage(niceError(e)); } finally { setBusy(false); }
  }

  return <div className="auth-page">
    <div className="auth-brand">
      <div className="logos"><img src={SCHOOL_LOGO} alt="مدارس المشكاة"/><img src={GUIDANCE_LOGO} alt="التوجيه الطلابي"/></div>
      <span>مدارس المشكاة الأهلية</span>
      <h1>بنك التميز الطلابي</h1>
      <p>منصة إلكترونية لإصدار شيكات التميز وإدارة نقاط الطلاب ومكافآتهم.</p>
    </div>
    <div className="auth-card">
      <div className="auth-tabs">
        <button className={mode==="password"?"active":""} onClick={()=>{setMode("password");setMessage("")}}>دخول الإدارة</button>
        <button className={mode==="teacher"?"active":""} onClick={()=>{setMode("teacher");setMessage("")}}>دخول الهيئة</button>
        <button className={mode==="student"?"active":""} onClick={()=>{setMode("student");setMessage("")}}>دخول الطالب</button><button className={mode==="guardian"?"active":""} onClick={()=>{setMode("guardian");setMessage("")}}>دخول ولي الأمر</button>
      </div>
      {mode==="password" && <form onSubmit={passwordLogin} className="form-stack"><h2>دخول الإدارة</h2><p>دخول مدير النظام والإدارة بالبريد الإلكتروني وكلمة المرور.</p>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>كلمة المرور<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="btn primary" disabled={busy}>دخول</button>
      </form>}
      {mode==="password"&&<AdminPasswordReset/>}
      {mode==="teacher"&&<TeacherLogin/>}
      {mode==="student"&&<StudentLogin/>}
      {mode==="guardian"&&<GuardianLogin/>}
      {message && <div className="notice">{message}</div>}
    </div>
  </div>;
}

function VerifyView({ nonce }: { nonce: string }) {
  const [data,setData]=useState<any>(null); const [error,setError]=useState("");
  useEffect(()=>{rpc("api_verify_check",{p_nonce:nonce}).then(setData).catch(e=>setError(niceError(e)))},[nonce]);
  if(error) return <div className="full-center"><div className="verify-card invalid"><h1>تعذر التحقق</h1><p>{error}</p></div></div>;
  if(!data) return <Loading text="جارٍ التحقق من شيك التميز..."/>;
  return <div className="full-center"><div className={`verify-card ${data.valid?"valid":"invalid"}`}>
    <div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div>
    {data.valid ? <><span className="verify-icon">✓</span><h1>شيك تميز صحيح</h1><h2>{data.student_name}</h2><div className="verify-grid"><div><small>رقم الشيك</small><b>{data.serial_no}</b></div><div><small>النقاط</small><b>{data.points}</b></div><div><small>السبب</small><b>{data.reason}</b></div><div><small>الحالة</small><b>{data.status}</b></div></div><p>{data.school}</p></> : <><span className="verify-icon">×</span><h1>الشيك غير موجود</h1><p>رمز التحقق غير صحيح أو غير مسجل.</p></>}
  </div></div>;
}

function PendingAccount({ profile, onRefresh }: { profile: Profile; onRefresh: ()=>void }) {
  // AUTO_PORTAL_ACCOUNT_LINK
  const email=String(profile.email||"").trim().toLowerCase();
  const staffSuffix="@staff.mishkat.sa";const studentSuffix="@students.mishkat.sa";
  const portalKey=email.endsWith(staffSuffix)?"T:"+email.slice(0,-staffSuffix.length):email.endsWith(studentSuffix)?email.slice(0,-studentSuffix.length):"";
  const [busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  async function repair(){if(!portalKey||busy)return;setBusy(true);setMessage("");try{if(portalKey.startsWith("T:")){const mobile=portalKey.slice(2);const lookup=await rpc("api_student_lookup",{p_student_no:portalKey});if(lookup?.job_title==="معلم")await rpc("api_claim_teacher_account",{p_mobile:mobile});else await rpc("api_claim_student_account",{p_student_no:portalKey})}else await rpc("api_claim_student_account",{p_student_no:portalKey});await onRefresh()}catch(e){setMessage(niceError(e))}finally{setBusy(false)}}
  useEffect(()=>{if(portalKey)void repair()},[portalKey]);
  const linking=Boolean(portalKey)&&!message;
  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">{linking?"⏳":"!"}</span><h1>{linking?"جارٍ ربط الحساب بالنظام":"تعذر إكمال ربط الحساب"}</h1><p>{linking?"يتم الآن التحقق من بيانات حسابك وربطه تلقائيًا بالمدرسة.":profile.name||profile.email}</p>{message&&<div className="notice error">{message}</div>}{portalKey&&message&&<button className="btn primary" disabled={busy} onClick={repair}>{busy?"جارٍ الربط...":"إعادة محاولة ربط الحساب"}</button>}<button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
}

function AppShell({ profile, children, tab, setTab }: { profile: Profile; children: any; tab: Tab; setTab:(t:Tab)=>void }) {
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  const handlesReferrals=profile.roles?.some(r=>["VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));
  const canWatchBehavior=profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r));
  const [referralCount,setReferralCount]=useState(0);
  const [behaviorStatus,setBehaviorStatus]=useState<any>(null);
  useEffect(()=>{
    let alive=true;
    async function loadIndicators(){
      if(handlesReferrals){try{const rows=await rpc<any[]>("api_student_referrals",{p_status:"OPEN"});if(alive)setReferralCount(Array.isArray(rows)?rows.length:0)}catch{}}
      if(canWatchBehavior){try{const data=await rpc<any>("api_behavioral_excellence");if(alive)setBehaviorStatus(data)}catch{}}
    }
    loadIndicators();const timer=window.setInterval(loadIndicators,15000);
    const onVisible=()=>{if(document.visibilityState==="visible")loadIndicators()};
    window.addEventListener("behavioral-status-changed",loadIndicators);document.addEventListener("visibilitychange",onVisible);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener("behavioral-status-changed",loadIndicators);document.removeEventListener("visibilitychange",onVisible)};
  },[handlesReferrals,canWatchBehavior]);
  const nav:Array<[Tab,string,string]>=[["dashboard","الرئيسية","⌂"],["checks","شيكات التميز","▣"],["khameesna","خميسنا غير","🏆"],["students","الطلاب والمحافظ","◎"],["rankings","لوحة الترتيب","★"],["rewards","المكافآت","◇"]];
  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r))) nav.splice(Math.min(3,nav.length),0,["referrals","تحويلات الطلاب","↗"]);
  if(profile.roles?.includes("GUIDANCE_COUNSELOR")) nav.splice(Math.min(4,nav.length),0,["redemption","الاستبدال","⇄"]);
  // BEHAVIORAL_TEACHER_TAB_ALWAYS_V1: teachers always see the tab; nomination availability is controlled inside the page.
  const showBehavior=profile.roles?.some(r=>["TEACHER","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r));
  if(showBehavior) nav.splice(Math.min(5,nav.length),0,["behavioral","التميز السلوكي","✦"]);
  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.splice(Math.min(4,nav.length),0,["student-evaluations","تقارير التقييم","▤"]);
  if(profile.roles?.includes("TEACHER")) nav.push(["followup","دفتر المتابعة","▤"]);
  if(profile.roles?.some(r=>["TEACHER","VICE_PRINCIPAL","GUIDANCE_COUNSELOR","SUPER_ADMIN"].includes(r))) nav.push(["periodic-evaluations","التقييم الدوري","◎"]);
  nav.push(["account","حسابي","◉"]);
  if(isAdmin) nav.push(["admin","الهيئة والصلاحيات","⚙"]);
  if(profile.roles?.includes("SUPER_ADMIN")) nav.push(["system","إعدادات النظام","◆"]);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>مدارس المشكاة الأهلية</span></div></div><nav>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}{id==="referrals"&&referralCount>0&&<i className="nav-notification">{referralCount>99?"99+":referralCount}</i>}</button>)}</nav><div className="issuer-card"><div className="issuer-profile-line"><div className="issuer-avatar">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{profile.name?.trim()?.charAt(0)||"م"}</span>}</div><div><small>المستخدم</small><b>{profile.name}</b></div></div><span>{profile.roles?.includes("TEACHER")?"معلم معتمد":"إدارة"}</span>{profile.can_issue && <><small>المتاح هذا الشهر</small><strong>{profile.is_unlimited?"غير محدود":profile.remaining ?? "—"} نقطة</strong></>}</div><button className="signout" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></aside><div className="main-area"><NotificationCenter/>{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © مدارس المشكاة الأهلية</span></footer></div></div>;
}
function DashboardView({ data, checks }: { data: Dashboard|null; checks: Check[] }) {
  if(!data) return <Loading/>;
  return <><Header title="لوحة بنك التميز الطلابي" subtitle="بيانات مباشرة وآمنة من Neon"/><main className="content"><section className="hero"><div><span className="eyebrow">مدارس المشكاة الأهلية</span><h2>التميز يُرى، يُقاس، ويُكافأ.</h2><p>شيكات تميز رقمية، محافظ طلابية، ترتيب فوري، ومتابعة عادلة للفصول.</p></div><div className="point-value"><small>قيمة نقطة التميز</small><strong>{Number(data.point_value_sar).toLocaleString("ar-SA")} ر.س</strong></div></section><section className="stats-grid"><Stat label="الطلاب" value={data.students}/><Stat label="نقاط اليوم" value={data.today_points}/><Stat label="شيكات هذا الشهر" value={data.month_checks}/><Stat label="طلاب حصلوا على تعزيز" value={data.reinforced_students}/></section><section className="panel"><div className="panel-title"><div><h3>آخر شيكات التميز</h3><p>آخر العمليات المسجلة في البنك.</p></div></div>{checks.length?<div className="activity-list">{checks.slice(0,8).map(c=><div className="activity" key={c.id}><span className="points">+{c.points}</span><div><b>{c.student_name}</b><small>{c.reason_ar || c.reason} — {c.issuer_name}</small></div><time>{new Date(c.issued_at).toLocaleDateString("ar-SA")}</time></div>)}</div>:<Empty text="لم يتم إصدار شيكات حتى الآن."/>}</section></main></>;
}

function Stat({label,value}:{label:string;value:number|string}) { return <article className="stat"><span>{label}</span><strong>{Number(value).toLocaleString("ar-SA")}</strong></article>; }
function Header({title,subtitle}:{title:string;subtitle:string}) { return <header className="topbar"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="header-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div></header>; }
function Empty({text}:{text:string}) { return <div className="empty">{text}</div>; }

function ChecksView({students,rules,onIssued}:{students:Student[];rules:Rule[];onIssued:()=>Promise<void>}) {
  const [query,setQuery]=useState(""); const [studentId,setStudentId]=useState(""); const [ruleId,setRuleId]=useState(""); const [points,setPoints]=useState(2); const [reason,setReason]=useState(""); const [notes,setNotes]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [issued,setIssued]=useState<Check|null>(null); const [qr,setQr]=useState("");
  const filtered=useMemo(()=>students.filter(s=>`${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}`.includes(query.trim())).slice(0,60),[students,query]);
  function chooseRule(id:string){setRuleId(id);const r=rules.find(x=>x.id===id);if(r){setPoints(r.default_points);setReason(r.name_ar)}}
  async function submit(e:FormEvent){e.preventDefault();if(!studentId||!ruleId)return;setBusy(true);setMessage("");try{const result=await rpc<Check>("api_issue_check",{p_student_id:studentId,p_rule_id:ruleId,p_points:points,p_reason_ar:reason,p_notes:notes||null});setIssued(result);setQr(await QRCode.toDataURL(`${BASE_URL}?verify=${result.qr_nonce}`,{width:280,margin:1,errorCorrectionLevel:"M"}));setMessage("تم إصدار شيك التميز وتحديث محفظة الطالب.");await onIssued();}catch(e){setMessage(niceError(e))}finally{setBusy(false)}}
  return <><Header title="إصدار شيك تميز" subtitle="اختر الطالب والبطاقة فقط — قيمة النقاط محددة مركزيًا من مدير النظام"/><main className="content"><section className="grid-2"><form className="panel form-stack" onSubmit={submit}><h3>بيانات الشيك</h3><label>ابحث عن الطالب<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="الاسم أو رقم الطالب"/></label><label>الطالب<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">اختر الطالب</option>{filtered.map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade_name} / {s.class_name}</option>)}</select></label><label>فئة التميز<select required value={ruleId} onChange={e=>chooseRule(e.target.value)}><option value="">اختر الفئة</option>{rules.map(r=><option key={r.id} value={r.id}>{r.name_ar} ({r.default_points} نقاط){r.is_mega?" — شيك عملاق":""}</option>)}</select></label><div className="form-row"><div className="fixed-point-value"><span>نقاط البطاقة</span><strong>{points}</strong><small>يحددها مدير النظام فقط</small></div><label>سبب الشيك<input required value={reason} onChange={e=>setReason(e.target.value)}/></label></div><label>ملاحظات<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label><button className="btn primary" disabled={busy}>{busy?"جارٍ الإصدار...":"إصدار شيك التميز"}</button>{message&&<div className="notice">{message}</div>}</form><section className="panel rule-panel"><h3>الفئات المتاحة لحسابك</h3>{rules.length?<div className="rules">{rules.map(r=><button key={r.id} className={ruleId===r.id?"rule active":"rule"} onClick={()=>chooseRule(r.id)}><b>{r.name_ar}</b><span>{r.default_points} نقاط</span>{r.is_mega&&<small>خاص بالإدارة والتوجيه</small>}</button>)}</div>:<Empty text="لا توجد فئات إصدار متاحة لهذه الصلاحية."/>}</section></section>{issued&&<section className="check-print panel"><div className="check-head"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>بنك التميز الطلابي</span><h2>شيك تميز</h2></div><b>{issued.serial_no}</b></div><div className="check-body"><div><small>الطالب</small><h2>{issued.student_name}</h2><small>سبب التميز</small><h3>{issued.reason}</h3><div className="big-points">+{issued.points} نقطة</div></div>{qr&&<div className="qr"><img src={qr}/><small>امسح للتحقق من الشيك</small></div>}</div><button className="btn ghost no-print" onClick={()=>window.print()}>طباعة الشيك</button></section>}</main></>;
}

function StudentsView({students,roles,reload}:{students:Student[];roles:string[];reload:()=>Promise<void>}){
  const[q,setQ]=useState("");
  const[activeClass,setActiveClass]=useState("ALL");
  const canEditStudentClass=roles.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","VICE_PRINCIPAL","GUIDANCE_COUNSELOR"].includes(r));
  const groups=useMemo(()=>{
    const map=new Map<string,{key:string;grade_name:string;class_name:string;students:Student[]}>();
    students.forEach(s=>{
      const key=s.grade_name+"|||"+s.class_name;
      if(!map.has(key))map.set(key,{key,grade_name:s.grade_name,class_name:s.class_name,students:[]});
      map.get(key)!.students.push(s);
    });
    const gradeRank=(name:string)=>/الأول|الاول/.test(name)?1:/الثاني|ثانى|ثاني/.test(name)?2:/الثالث|ثالث/.test(name)?3:99;
    return Array.from(map.values()).sort((a,b)=>{
      const stageA=/المتوسط|متوسط/.test(a.grade_name)?1:/الثانوي|ثانوي/.test(a.grade_name)?2:3;
      const stageB=/المتوسط|متوسط/.test(b.grade_name)?1:/الثانوي|ثانوي/.test(b.grade_name)?2:3;
      if(stageA!==stageB)return stageA-stageB;
      const gradeDiff=gradeRank(a.grade_name)-gradeRank(b.grade_name);
      if(gradeDiff!==0)return gradeDiff;
      return a.class_name.localeCompare(b.class_name,"ar",{numeric:true});
    });
  },[students]);
  const middleGroups=groups.filter(g=>/المتوسط|متوسط/.test(g.grade_name));
  const secondaryGroups=groups.filter(g=>/الثانوي|ثانوي/.test(g.grade_name));
  const otherGroups=groups.filter(g=>!/المتوسط|متوسط|الثانوي|ثانوي/.test(g.grade_name));
  useEffect(()=>{if(activeClass!=="ALL"&&!groups.some(g=>g.key===activeClass))setActiveClass("ALL")},[activeClass,groups]);
  const selected=activeClass==="ALL"?null:groups.find(g=>g.key===activeClass)||null;
  const scoped=selected?selected.students:students;
  const list=scoped.filter(s=>`${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}`.includes(q));
  const total=students.reduce((a,s)=>a+Number(s.points),0);
  const renderTabs=(items:typeof groups)=>items.map(g=><button type="button" key={g.key} className={activeClass===g.key?"active":""} onClick={()=>setActiveClass(g.key)}><b>{g.grade_name}</b><small>فصل {g.class_name}</small><span>{g.students.length}</span></button>);
  return <><Header title="الطلاب والمحافظ" subtitle="كل طالب يظهر داخل قائمة فصله — والأرصدة ناتجة من دفتر الحركات"/><main className="content">
    <section className="stats-grid"><Stat label="إجمالي الطلاب" value={students.length}/><Stat label="طلاب لديهم نقاط" value={students.filter(s=>Number(s.points)>0).length}/><Stat label="إجمالي النقاط" value={total}/><Stat label="عدد الفصول" value={groups.length}/></section>
    <section className="panel student-wallet-panel">
      <div className="panel-title"><div><h3>محافظ الطلاب</h3><p>{selected?selected.grade_name+" — فصل "+selected.class_name:"جميع الطلاب"} · {scoped.length} طالب</p></div><input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث داخل القائمة..."/></div>
      <div className="student-tabs-all"><button type="button" className={activeClass==="ALL"?"active":""} onClick={()=>setActiveClass("ALL")}><b>كل الطلاب</b><span>{students.length}</span></button></div>
      <div className="student-stage-rows">
        {middleGroups.length>0&&<div className="student-stage-row middle-stage"><div className="stage-row-title"><b>المرحلة المتوسطة</b><span>{middleGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(middleGroups)}</div></div>}
        {secondaryGroups.length>0&&<div className="student-stage-row secondary-stage"><div className="stage-row-title"><b>المرحلة الثانوية</b><span>{secondaryGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(secondaryGroups)}</div></div>}
        {otherGroups.length>0&&<div className="student-stage-row"><div className="stage-row-title"><b>فصول أخرى</b><span>{otherGroups.reduce((n,g)=>n+g.students.length,0)} طالب</span></div><div className="student-class-tabs">{renderTabs(otherGroups)}</div></div>}
      </div>
      {list.length?<div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الرقم</th><th>الصف</th><th>الفصل</th><th>المستوى</th><th>الرصيد</th><th>القيمة</th>{canEditStudentClass&&<th>الإجراء</th>}</tr></thead><tbody>{list.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.student_no}</td><td>{s.grade_name}</td><td>{s.class_name}</td><td><span className="pill">{s.level}</span></td><td><b>{s.points} نقطة</b></td><td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td>{canEditStudentClass&&<td><div className="student-row-actions"><StudentClassEditor student={s} onChanged={reload}/><StudentMobileEditor student={s}/></div></td>}</tr>)}</tbody></table></div>:<Empty text={q?"لا يوجد طالب مطابق للبحث داخل هذا الفصل.":"لا يوجد طلاب في هذه القائمة."}/>} 
    </section>
  </main></>;
}

function RankingsView({data}:{data:Rankings|null}){if(!data)return <Loading/>;return <><Header title="لوحة الترتيب" subtitle="ترتيب الطلاب والفصول من النقاط الفعلية"/><main className="content grid-2"><section className="panel"><h3>أوائل الطلاب</h3><div className="rank-list">{data.students.slice(0,10).map((s,i)=><div className="rank" key={s.id}><span>{i+1}</span><div><b>{s.name}</b><small>{s.grade_name} — فصل {s.class_name}</small></div><strong>{s.points} نقطة</strong></div>)}</div></section><section className="panel"><h3>ترتيب الفصول</h3><p>المعيار: متوسط النقاط لكل طالب، ثم إجمالي النقاط.</p><div className="table-wrap"><table><thead><tr><th>#</th><th>الصف</th><th>الفصل</th><th>الطلاب</th><th>الإجمالي</th><th>المتوسط</th></tr></thead><tbody>{data.classes.map((c,i)=><tr key={c.id}><td><b>{i+1}</b></td><td>{c.grade_name}</td><td>{c.class_name}</td><td>{c.student_count}</td><td>{c.total_points}</td><td><b>{Number(c.average_points).toFixed(2)}</b></td></tr>)}</tbody></table></div></section></main></>}

function RewardsView({rewards}:{rewards:Reward[]}){return <><Header title="متجر المكافآت" subtitle="المكافآت المعتمدة في بنك التميز"/><main className="content"><div className="reward-grid">{rewards.map(r=><article className="reward" key={r.id}><span>مكافأة</span><h3>{r.name_ar}</h3><p>{r.description_ar||"مكافأة للطلاب المتميزين"}</p><strong>{r.cost_points} نقطة</strong>{r.cash_value_sar!=null&&<small>قيمة تقديرية {r.cash_value_sar} ر.س</small>}</article>)}</div></main></>}


function KhameesnaView({data,reload}:{data:KhameesnaBoard|null;reload:()=>Promise<void>}){
  const[classId,setClassId]=useState("");const[points,setPoints]=useState(5);const[lessonNo,setLessonNo]=useState(1);const[subject,setSubject]=useState("");const[reason,setReason]=useState("");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
  if(!data)return <Loading text="جارٍ تحميل مسابقة خميسنا غير..."/>;
  const closed=data.status==="CLOSED";const max=Math.max(Number(data.max_points)||0,1);const leader=data.standings[0];const hasLeader=leader&&Number(leader.total_points)>0;const tied=hasLeader&&data.leader_count>1;
  const date=(v:string)=>new Date(v+"T12:00:00").toLocaleDateString("ar-SA",{day:"numeric",month:"long"});
  async function submit(e:FormEvent){e.preventDefault();if(!classId||closed)return;setBusy(true);setMsg("");try{await rpc("api_khameesna_add_points",{p_class_id:classId,p_points:points,p_lesson_no:lessonNo,p_subject_ar:subject||null,p_reason_ar:reason||null});setMsg("تمت إضافة نقاط الفصل وتحديث ترتيب الأسبوع مباشرة.");setReason("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}
  return <><Header title="خميسنا غير" subtitle="مسابقة أسبوعية تنافسية بين الفصول — الأعلى نقاطًا يستحق رحلة الخميس"/><main className="content">
    <section className="khameesna-hero"><div className="khameesna-title"><span className="eyebrow">🏆 تنافس الفصول</span><h2>خميسنا غير</h2><p>كل حصة فرصة للفصل أن يتقدم. المعلم يضيف نقاط الفصل في نهاية الحصة، والترتيب يتحدث لحظيًا حتى الخميس.</p></div><div className="week-chip"><small>أسبوع المسابقة</small><strong>{date(data.week_start)} — {date(data.week_end)}</strong><span>{data.status==="THURSDAY"?"اليوم يوم الحسم والرحلة":closed?"انتهى أسبوع المسابقة — يبدأ أسبوع جديد الأحد":"المسابقة جارية الآن"}</span></div></section>
    <section className="khameesna-grid"><form className="panel form-stack khameesna-form" onSubmit={submit}><div className="panel-title"><div><h3>إضافة نقاط بعد الحصة</h3><p>تُسجل باسم المعلم والحصة والتاريخ لمنع التكرار.</p></div><span className="counter">+ نقاط</span></div>{closed&&<div className="competition-closed">المسابقة الأسبوعية مغلقة يومي الجمعة والسبت. يبدأ احتساب الأسبوع الجديد صباح الأحد.</div>}<label>الفصل<select required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">اختر الفصل</option>{data.allowed_classes.map(c=><option key={c.class_id} value={c.class_id}>{c.grade_name} — فصل {c.class_name}</option>)}</select></label><div className="form-row"><label>رقم الحصة<select value={lessonNo} onChange={e=>setLessonNo(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>الحصة {n}</option>)}</select></label><label>المادة<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="مثال: رياضيات"/></label></div><label>نقاط الفصل<div className="score-picks">{[1,2,3,5,10].map(n=><button type="button" key={n} className={points===n?"score-pick active":"score-pick"} onClick={()=>setPoints(n)}>+{n}</button>)}</div></label><label>سبب النقاط<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="مثال: مشاركة ممتازة وانضباط الحصة"/></label><button className="btn primary" disabled={busy||closed||!classId}>{busy?"جارٍ الإضافة...":"إضافة نقاط الفصل"}</button>{msg&&<div className="notice">{msg}</div>}</form>
    <section className="panel"><div className="panel-title"><div><h3>ترتيب فصول الأسبوع</h3><p>الأعلى مجموعًا يتصدر مباشرة.</p></div><span className="counter">{data.standings.length}</span></div>{hasLeader?<div className="leader-card"><div className="leader-medal">🏆</div><div><small>{tied?"تعادل على صدارة الأسبوع":"متصدر الأسبوع"}</small><b>{tied?"أكثر من فصل متعادل":leader.grade_name+" — فصل "+leader.class_name}</b><span>{tied?"الحسم بأعلى نقاط قبل نهاية الخميس":leader.total_points+" نقطة — "+data.reward}</span></div></div>:<div className="leader-card"><div className="leader-medal">🏁</div><div><small>البداية من الصفر</small><b>في انتظار أول نقاط هذا الأسبوع</b><span>أول معلم يسجل نقاط الحصة سيبدأ لوحة المنافسة.</span></div></div>}<div className="class-standings">{data.standings.map((c,i)=><div className={i===0&&Number(c.total_points)>0?"class-standing top":"class-standing"} key={c.class_id}><span className="position">{i+1}</span><div className="class-meta"><b>{c.grade_name} — فصل {c.class_name}</b><small>{c.awards_count} إضافة نقاط هذا الأسبوع</small><div className="standing-bar"><i style={{width:(Number(c.total_points)>0?Math.max(5,Number(c.total_points)/max*100):0)+"%"}}/></div></div><div className="class-score"><strong>{c.total_points}</strong><small>نقطة</small></div></div>)}</div></section></section>
    <section className="grid-2 khameesna-recent"><section className="panel"><h3>آخر نقاط أضافها المعلمون</h3>{data.recent.length?<div>{data.recent.map(r=><div className="khameesna-entry" key={r.id}><span className="entry-points">+{r.points}</span><div><b>{r.grade_name} — فصل {r.class_name}</b><small>{r.teacher_name} · الحصة {r.lesson_no}{r.subject_ar?" · "+r.subject_ar:""}{r.reason_ar?" · "+r.reason_ar:""}</small></div><time>{new Date(r.awarded_at).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}</time></div>)}</div>:<Empty text="لا توجد إضافات نقاط هذا الأسبوع بعد."/>}</section><section className="panel"><h3>أبطال الأسابيع السابقة</h3><p>سجل الفصول التي أنهت الأسبوع في المركز الأول.</p>{data.history.length?<div className="winner-history">{data.history.map((h,i)=><div className="winner-chip" key={h.week_start+h.class_id+i}><b>🏆 {h.grade_name} — فصل {h.class_name}</b><small>أسبوع {date(h.week_start)} · {h.total_points} نقطة</small></div>)}</div>:<Empty text="سيظهر هنا سجل الفائزين بعد نهاية أول أسبوع."/>}</section></section>
  </main></>;
}

function AdminView({pending,users,staff,classes,reload,isSuperAdmin}:{pending:PendingUser[];users:ManagedUser[];staff:StaffMember[];classes:AdminClass[];reload:()=>Promise<void>;isSuperAdmin:boolean}){
  const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  const[draftStaff,setDraftStaff]=useState<Record<string,string>>({});
  const[draftClasses,setDraftClasses]=useState<Record<string,string[]>>({});
  const[draftLimit,setDraftLimit]=useState<Record<string,string>>({});
  const[editing,setEditing]=useState<string>("");const[editStaff,setEditStaff]=useState("");const[editClasses,setEditClasses]=useState<string[]>([]);const[staffAssignmentOpen,setStaffAssignmentOpen]=useState("");const[staffAssignmentClasses,setStaffAssignmentClasses]=useState<string[]>([]);
  const roleLabel=(r:string)=>({SUPER_ADMIN:"مدير النظام",SCHOOL_ADMIN:"إدارة المدرسة",PRINCIPAL:"مدير المدرسة",VICE_PRINCIPAL:"وكيل المدرسة",GUIDANCE_COUNSELOR:"موجه طلابي",TEACHER:"معلم",REWARD_OFFICER:"مسؤول المكافآت"} as Record<string,string>)[r]||r;
  const selectedStaff=(id:string)=>staff.find(s=>s.id===id);
  function togglePending(uid:string,cid:string){setDraftClasses(v=>{const a=v[uid]||[];return {...v,[uid]:a.includes(cid)?a.filter(x=>x!==cid):[...a,cid]}})}
  function toggleEdit(cid:string){setEditClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}
  function openStaffAssignment(s:StaffMember){setStaffAssignmentOpen(s.id);setStaffAssignmentClasses(s.assigned_class_ids||[]);setMsg("")}
  function toggleStaffAssignment(cid:string){setStaffAssignmentClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}
  async function saveStaffAssignment(){const s=staff.find(x=>x.id===staffAssignmentOpen);if(!s)return;if(!staffAssignmentClasses.length){setMsg("اختر فصلًا واحدًا على الأقل للموظف.");return}setBusy(staffAssignmentOpen);try{await rpc("api_set_staff_classes",{p_staff_id:staffAssignmentOpen,p_class_ids:staffAssignmentClasses});setMsg("تم تسكين "+s.full_name_ar+" على الفصول المحددة. طلاب هذه الفصول أصبحوا نطاقه عند ربط حسابه.");setStaffAssignmentOpen("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function changeTeacherMobile(s:StaffMember){
    if(!isSuperAdmin||s.job_title_ar!=="معلم")return;
    const current=String(s.mobile||"").trim();
    const raw=window.prompt("رقم الجوال الجديد للمعلم "+s.full_name_ar,current);
    if(raw===null)return;
    const mobile=raw.replace(/\D/g,"");
    if(!/^05\d{8}$/.test(mobile)){setMsg("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05.");return}
    if(mobile===current){setMsg("رقم الجوال الجديد مطابق للرقم الحالي.");return}
    const warning=s.linked?"سيتم تغيير اسم دخول المعلم إلى "+mobile+" مع الإبقاء على كلمة المرور الحالية كما هي.":"سيصبح اسم المستخدم "+mobile+" وكلمة المرور الافتراضية "+mobile+"Aa عند أول دخول.";
    if(!window.confirm(warning+" هل تريد المتابعة؟"))return;
    const key="mobile:"+s.id;setBusy(key);setMsg("");
    try{
      const result=await rpc<any>("api_set_staff_classes",{p_staff_id:s.id,p_class_ids:{action:"UPDATE_TEACHER_MOBILE",mobile}});
      setMsg(result?.linked?"تم تغيير اسم دخول "+s.full_name_ar+" إلى "+mobile+". كلمة المرور الحالية لم تتغير.":"تم تغيير جوال "+s.full_name_ar+". اسم المستخدم: "+mobile+" — كلمة المرور الافتراضية: "+mobile+"Aa");
      await reload();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  async function resetTeacherPassword(s:StaffMember){
    if(!isSuperAdmin||s.job_title_ar!=="معلم"||!s.linked_app_user_id)return;
    const u=users.find(x=>x.id===s.linked_app_user_id);
    if(!u?.auth_user_id){setMsg("تعذر العثور على حساب الدخول المرتبط بهذا المعلم.");return}
    const mobile=String(s.mobile||"").replace(/\D/g,"");
    if(!/^05\d{8}$/.test(mobile)){setMsg("رقم جوال المعلم غير صالح لإعادة كلمة المرور.");return}
    const newPassword=mobile+"Aa";
    if(!window.confirm("سيتم إعادة كلمة مرور "+s.full_name_ar+" إلى: "+newPassword+". هل تريد المتابعة؟"))return;
    const key="password:"+s.id;setBusy(key);setMsg("");
    try{
      const res=await fetch(AUTH_URL+"/admin/set-user-password",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:u.auth_user_id,newPassword})});
      let body:any={};try{body=await res.json()}catch{}
      if(!res.ok)throw new Error(body?.message||body?.error||"تعذر إعادة كلمة المرور.");
      setMsg("تمت إعادة كلمة مرور "+s.full_name_ar+" بنجاح. اسم المستخدم: "+mobile+" — كلمة المرور: "+newPassword);
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  async function approve(u:PendingUser){const sid=draftStaff[u.auth_user_id];const member=selectedStaff(sid);const cids=draftClasses[u.auth_user_id]||[];if(!member){setMsg("اختر اسم الموظف من قائمة الهيئة أولًا.");return}if(isClassScopedJob(member.job_title_ar)&&!cids.length){setMsg("يجب تسكين الموظف في فصل واحد على الأقل قبل الاعتماد.");return}setBusy(u.auth_user_id);setMsg("");try{await rpc("api_approve_teacher_scoped",{p_auth_user_id:u.auth_user_id,p_staff_id:sid,p_monthly_limit:Number(draftLimit[u.auth_user_id]||100),p_class_ids:cids});setMsg("تم اعتماد وربط "+member.full_name_ar+" وتطبيق نطاق الفصول.");setDraftStaff(v=>({...v,[u.auth_user_id]:""}));setDraftClasses(v=>({...v,[u.auth_user_id]:[]}));await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function budget(u:ManagedUser){const raw=window.prompt("الحد الشهري الجديد لـ "+u.name,String(u.monthly_limit||100));if(!raw)return;try{await rpc("api_set_teacher_budget",{p_app_user_id:u.id,p_monthly_limit:Number(raw),p_unlimited:false});setMsg("تم تحديث حد الإصدار.");await reload()}catch(e){setMsg(niceError(e))}}
  function startEdit(u:ManagedUser){setEditing(u.id);setEditStaff(u.staff_id||"");setEditClasses(u.assigned_class_ids||[]);setMsg("")}
  async function saveScope(){const u=users.find(x=>x.id===editing);const member=selectedStaff(editStaff);if(!u||!member)return;if(isClassScopedJob(member.job_title_ar)&&!editClasses.length){setMsg("يجب تسكين الموظف في فصل واحد على الأقل.");return}setBusy(editing);try{await rpc("api_set_user_scope",{p_app_user_id:editing,p_staff_id:editStaff,p_class_ids:editClasses});setMsg("تم حفظ وظيفة وفصول "+member.full_name_ar+".");setEditing("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  const freeStaff=staff.filter(s=>!s.linked);
  return <><Header title="الهيئة والصلاحيات" subtitle="ربط حساب الموظف بوظيفته وتحديد الفصول التي يستطيع التعامل معها"/><main className="content">
    <section className="permission-policy"><div><b>الصلاحيات مقيدة بالفصول</b><span>المعلم والمدير والوكيل والموجه الطلابي يرون طلاب الفصول المسندة لهم فقط، ويعمل خميسنا غير داخل نفس النطاق.</span></div><div><b>خميسنا غير: مرة واحدة يوميًا</b><span>لا يستطيع نفس المستخدم إضافة نقاط لنفس الفصل أكثر من مرة في اليوم.</span></div><div><b>نوع الشيك حسب الوظيفة</b><span>المعلم: الشيكات العادية فقط. مدير المدرسة والوكيل والموجه الطلابي: شيك التميز العملاق فقط.</span></div></section>
    <AddTeacherPanel classes={classes} reload={reload}/>
    <RewardPermissionPanel users={users} reload={reload}/>
    <StaffBudgetPanel/>
    <StudentExcelImporter onImported={reload}/>
    <section className="panel"><div className="panel-title"><div><h3>المستخدمون</h3><p>الحسابات المرتبطة بدليل الهيئة وصلاحيات الفصول.</p></div><span className="counter">{users.length}</span></div><div className="table-wrap"><table><thead><tr><th>المستخدم</th><th>الوظيفة الرسمية</th><th>الصلاحيات</th><th>الفصول المسندة</th><th>حد الإصدار</th><th></th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b><small className="table-sub">{u.email}</small></td><td>{u.job_title_ar||<span className="muted">غير مربوط بالهيئة</span>}</td><td>{u.roles.map(roleLabel).join("، ")}</td><td><div className="assigned-class-lines">{u.assigned_classes?.length?u.assigned_classes.map((x,i)=><span key={i}>{x}</span>):<span>—</span>}</div></td><td>{u.is_unlimited?"غير محدود":u.monthly_limit??"—"}</td><td><div className="row-actions"><button className="mini-btn" onClick={()=>startEdit(u)}>إدارة الوظيفة والفصول</button><button className="mini-btn" onClick={()=>budget(u)}>تعديل الحد</button></div></td></tr>)}</tbody></table></div></section>
    {editing&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تعديل نطاق المستخدم</h3><p>{users.find(u=>u.id===editing)?.email}</p></div><button className="mini-btn" onClick={()=>setEditing("")}>إغلاق</button></div><label className="scope-label">الاسم والوظيفة<select value={editStaff} onChange={e=>{setEditStaff(e.target.value);const m=selectedStaff(e.target.value);if(!isClassScopedJob(m?.job_title_ar))setEditClasses([])}}><option value="">اختر من الهيئة</option>{staff.filter(s=>!s.linked||s.linked_app_user_id===editing).map(s=><option key={s.id} value={s.id}>{s.full_name_ar} — {s.job_title_ar}{s.specialty_ar?" — "+s.specialty_ar:""}</option>)}</select></label>{selectedStaff(editStaff)&&isClassScopedJob(selectedStaff(editStaff)?.job_title_ar)&&<div className="class-picker"><b>الفصول المسموح بها</b><p>المستخدم لن يرى أو يمنح نقاطًا لطلاب أي فصل غير محدد هنا.</p><div>{classes.map(c=><label key={c.id} className={editClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={editClasses.includes(c.id)} onChange={()=>toggleEdit(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div>}<button className="btn primary" disabled={busy===editing||!editStaff} onClick={saveScope}>{busy===editing?"جارٍ الحفظ...":"حفظ الوظيفة والفصول"}</button></section>}
    <StaffDirectoryTable staff={staff}/><section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3><p>من هنا يتم تسكين المعلمين ومدير المدرسة والوكيل والموجه الطلابي على الفصول.</p></div><span className="counter">{staff.length}</span></div><div className="staff-grid">{staff.map(s=><article className={s.linked?"staff-card linked":"staff-card"} key={s.id}><div><b>{s.full_name_ar}</b><span>{s.job_title_ar}</span></div>{s.job_title_ar==="معلم"?<small>{s.specialty_ar||s.teaching_subject_ar||"معلم"}</small>:<small>{s.job_title_ar}</small>}{isClassScopedJob(s.job_title_ar)&&<div className="staff-assigned-classes"><b>الفصول:</b><span>{s.assigned_classes?.length?s.assigned_classes.join("، "):"لم يتم التسكين بعد"}</span></div>}<em>{s.linked?"مرتبط بحساب":"غير مرتبط"}</em>{isSuperAdmin&&s.job_title_ar==="معلم"&&<button className="mini-btn" disabled={busy==="mobile:"+s.id} onClick={()=>changeTeacherMobile(s)}>{busy==="mobile:"+s.id?"جارٍ التغيير...":"تغيير رقم الجوال"}</button>}{isSuperAdmin&&s.job_title_ar==="معلم"&&s.linked&&<button className="mini-btn" disabled={busy==="password:"+s.id} onClick={()=>resetTeacherPassword(s)}>{busy==="password:"+s.id?"جارٍ إعادة التعيين...":"إعادة كلمة المرور"}</button>}{isClassScopedJob(s.job_title_ar)&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>}</article>)}</div></section>{staffAssignmentOpen&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تسكين الموظف على الفصول</h3><p>{staff.find(s=>s.id===staffAssignmentOpen)?.full_name_ar}</p></div><button className="mini-btn" onClick={()=>setStaffAssignmentOpen("")}>إغلاق</button></div><div className="class-picker"><b>اختر فصلًا أو أكثر</b><p>بعد الحفظ سيُربط الموظف بهذه الفصول وطلابها عند إنشاء حسابه أو ربطه لاحقًا.</p><div>{classes.map(c=><label key={c.id} className={staffAssignmentClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={staffAssignmentClasses.includes(c.id)} onChange={()=>toggleStaffAssignment(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div><button className="btn primary" disabled={busy===staffAssignmentOpen||!staffAssignmentClasses.length} onClick={saveStaffAssignment}>{busy===staffAssignmentOpen?"جارٍ الحفظ...":"حفظ التسكين"}</button></section>}
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>}

function BankApp({ profile, refreshProfile }: { profile: Profile; refreshProfile:()=>Promise<void> }) {
  // VERSIONED_DATA_CACHE_V3
  const [tab,setTab]=useState<Tab>("dashboard");
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [students,setStudents]=useState<Student[]>([]);
  const [rules,setRules]=useState<Rule[]>([]);
  const [checks,setChecks]=useState<Check[]>([]);
  const [rankings,setRankings]=useState<Rankings|null>(null);
  const [rewards,setRewards]=useState<Reward[]>([]);
  const [users,setUsers]=useState<ManagedUser[]>([]);
  const [staff,setStaff]=useState<StaffMember[]>([]);
  const [adminClasses,setAdminClasses]=useState<AdminClass[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const pending:PendingUser[]=[];
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  const cacheScope="staff:"+(profile.app_user_id||profile.auth_user_id||profile.email||"unknown");

  function applyCached(data:any){
    if(data?.dashboard!==undefined)setDashboard(data.dashboard||null);
    if(Array.isArray(data?.students))setStudents(data.students);
    if(Array.isArray(data?.rules))setRules(data.rules);
    if(Array.isArray(data?.checks))setChecks(data.checks);
    if(data?.rankings!==undefined)setRankings(data.rankings||null);
    if(Array.isArray(data?.rewards))setRewards(data.rewards);
    if(Array.isArray(data?.users))setUsers(data.users);
    if(Array.isArray(data?.staff))setStaff(data.staff);
    if(Array.isArray(data?.adminClasses))setAdminClasses(data.adminClasses);
  }

  async function syncData(keys:Array<"dashboard"|"students"|"rules"|"checks"|"rankings"|"rewards"|"admin">,force=false){
    setError("");
    const cached=readDataCache<any>(cacheScope);
    const base:any={...(cached?.data||{})};
    const oldVersions:CacheVersions={...(cached?.versions||{})};
    const nextVersions:CacheVersions={...oldVersions};
    let serverVersions:CacheVersions|null=null;

    async function pull(key:string){
      if(key==="dashboard"){base.dashboard=await rpc<Dashboard>("api_dashboard");setDashboard(base.dashboard)}
      else if(key==="students"){base.students=await rpc<Student[]>("api_students");setStudents(base.students)}
      else if(key==="rules"){base.rules=await rpc<Rule[]>("api_point_rules");setRules(base.rules)}
      else if(key==="checks"){base.checks=await rpc<Check[]>("api_recent_checks");setChecks(base.checks)}
      else if(key==="rankings"){base.rankings=await rpc<Rankings>("api_rankings");setRankings(base.rankings)}
      else if(key==="rewards"){base.rewards=await rpc<Reward[]>("api_rewards");setRewards(base.rewards)}
      else if(key==="admin"&&isAdmin){
        const [u,st,cl]=await Promise.all([rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);
        base.users=u;base.staff=st;base.adminClasses=cl;setUsers(u);setStaff(st);setAdminClasses(cl);
      }
      if(serverVersions)nextVersions[key]=serverVersions[key];
    }

    try{
      serverVersions=await rpc<CacheVersions>("api_cache_versions");
      const needs=(key:string)=>{
        const hasData=key==="admin"?Array.isArray(base.users)&&Array.isArray(base.staff)&&Array.isArray(base.adminClasses):base[key]!==undefined;
        return force||!hasData||!sameCacheVersion(oldVersions,serverVersions||{},key);
      };
      await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).filter(needs).map(k=>pull(k)));
      const latest=readDataCache<any>(cacheScope);
      writeDataCache(cacheScope,{...(latest?.versions||{}),...nextVersions},{...(latest?.data||{}),...base});
    }catch(e){
      if(!cached){
        try{
          serverVersions=null;
          await Promise.all(keys.filter(k=>k!=="admin"||isAdmin).map(k=>pull(k)));
          const latest=readDataCache<any>(cacheScope);
          writeDataCache(cacheScope,{...(latest?.versions||{})},{...(latest?.data||{}),...base});
        }catch(inner){setError(niceError(inner))}
      }
    }finally{setLoading(false)}
  }

  useEffect(()=>{
    const cached=readDataCache<any>(cacheScope);
    if(cached){applyCached(cached.data);if(cached.data?.dashboard)setLoading(false)}
    void syncData(["dashboard","checks"]);
  },[cacheScope]);

  useEffect(()=>{
    if(tab==="checks")void syncData(["students","rules","checks"]);
    else if(tab==="students"||tab==="referrals"||tab==="student-evaluations"||tab==="behavioral")void syncData(["students"]);
    else if(tab==="rankings")void syncData(["rankings"]);
    else if(tab==="rewards")void syncData(["rewards"]);
    else if(tab==="admin"&&isAdmin)void syncData(["admin"]);
  },[tab]);

  async function refreshStudents(){await syncData(["students","rankings"],true)}
  async function refreshRewards(){await syncData(["rewards"],true)}
  async function refreshAdmin(){await syncData(["admin","students","rules"],true)}
  async function afterIssued(){await Promise.all([syncData(["dashboard","checks","students","rankings"],true),refreshProfile()])}

  return <AppShell profile={profile} tab={tab} setTab={setTab}>{loading&&!dashboard?<Loading/>:<>{error&&<div className="notice error global-error">{error}</div>}{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks}/>} {tab==="checks"&&<><ChecksView students={students} rules={rules} onIssued={afterIssued}/>{profile.roles?.includes("TEACHER")&&<main className="content teacher-check-manager-wrap"><TeacherCheckManager onChanged={afterIssued}/></main>}</>} {tab==="students"&&<StudentsView students={students} roles={profile.roles||[]} reload={refreshStudents}/>} {tab==="rankings"&&<RankingsView data={rankings}/>} {tab==="rewards"&&<><RewardsView rewards={rewards}/>{profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL","REWARD_OFFICER"].includes(r))&&<main className="content reward-admin-wrap"><RewardManagementPanel onChanged={refreshRewards}/></main>}</>} {tab==="referrals"&&<ReferralCenter roles={profile.roles} students={students} profileName={profile.name||""}/>} {tab==="redemption"&&profile.roles?.includes("GUIDANCE_COUNSELOR")&&<GuidanceRedemptionCenter/>} {tab==="student-evaluations"&&<StudentEvaluationReports roles={profile.roles} students={students}/>} {tab==="followup"&&<StudentFollowupNotebook/>} {tab==="periodic-evaluations"&&<PeriodicEvaluationCenter/>} {tab==="behavioral"&&<BehavioralExcellence students={students}/>} {tab==="khameesna"&&<KhameesnaCompetition isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>} {tab==="account"&&<UserAccount profile={profile} onProfileChanged={refreshProfile}/>} {tab==="system"&&profile.roles?.includes("SUPER_ADMIN")&&<SystemControlPanel/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={refreshAdmin} isSuperAdmin={profile.roles?.includes("SUPER_ADMIN")===true}/>}</>}</AppShell>;
}

export default function App(){
  const verifyNonce=new URLSearchParams(window.location.search).get("verify");
  const sessionState=neon.auth.useSession();
  // AUTH_SESSION_BRIDGE_V3_APP: use getSession as the source-of-truth fallback instead of reloading the page.
  const [verifiedSession,setVerifiedSession]=useState<any>(null);
  const [sessionProbeDone,setSessionProbeDone]=useState(false);
  const sessionUserId=sessionState?.data?.user?.id||verifiedSession?.user?.id;
  async function probeSession(){
    try{
      const current=await neon.auth.getSession();
      setVerifiedSession(current?.data?.user?.id?current.data:null);
    }catch{
      setVerifiedSession(null);
    }finally{
      setSessionProbeDone(true);
    }
  }
  useEffect(()=>{
    void probeSession();
    const onAuthSuccess=()=>{setSessionProbeDone(false);void probeSession()};
    window.addEventListener("mishkat-auth-success",onAuthSuccess);
    return()=>window.removeEventListener("mishkat-auth-success",onAuthSuccess);
  },[]);
  useEffect(()=>{
    if(sessionState?.data?.user?.id){setVerifiedSession(sessionState.data);setSessionProbeDone(true);return}
    if(sessionProbeDone)void probeSession();
  },[sessionState?.data?.user?.id]);
  const [profile,setProfile]=useState<Profile|null>(null);const[profileError,setProfileError]=useState("");const[profileLoading,setProfileLoading]=useState(false);
  async function refreshProfile(){setProfileLoading(true);setProfileError("");try{let next:Profile|null=null;for(let attempt=0;attempt<4;attempt++){next=await rpc<Profile>("api_profile");if(next?.status!=="PENDING")break;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,300*(attempt+1)))}setProfile(next)}catch(e){setProfileError(niceError(e))}finally{setProfileLoading(false)}}
  useEffect(()=>{if(sessionUserId){sessionStorage.removeItem("mishkat-login-succeeded");sessionStorage.removeItem("mishkat-session-recovery-count");refreshProfile()}else setProfile(null)},[sessionUserId]);
  if(verifyNonce)return <VerifyView nonce={verifyNonce}/>;
  if((sessionState?.isPending||!sessionProbeDone)&&!sessionUserId)return <Loading text="جارٍ التحقق من الجلسة..."/>;
  if(!sessionUserId)return <AuthScreen/>;
  if(profileLoading&&!profile)return <Loading text="جارٍ تحميل صلاحيات الحساب..."/>;
  if(profileError&&!profile)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل الصلاحيات</h1><p>{profileError}</p><button className="btn primary" onClick={refreshProfile}>إعادة المحاولة</button><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
  if(!profile)return <Loading/>;
  if(profile.status!=="APPROVED")return <PendingAccount profile={profile} onRefresh={refreshProfile}/>;
  if(profile.roles?.includes("STUDENT"))return <StudentPortal cacheUserId={profile.app_user_id||profile.auth_user_id||profile.email||""}/>;
  if(profile.roles?.includes("GUARDIAN"))return <GuardianPortal/>;
  return <BankApp profile={profile} refreshProfile={refreshProfile}/>;
}

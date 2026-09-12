import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { neon, niceError, rpc } from "./client";

type Profile = {
  status: "PENDING" | "APPROVED" | "DISABLED";
  app_user_id?: string;
  auth_user_id?: string;
  name?: string;
  email?: string;
  roles: string[];
  can_issue: boolean;
  monthly_limit?: number | null;
  is_unlimited?: boolean;
  used_this_month?: number;
  remaining?: number | null;
};

type Student = { id: string; student_no: string; name: string; grade_name: string; class_name: string; points: number; value_sar: number; level: string };
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

type Tab = "dashboard" | "checks" | "khameesna" | "students" | "rankings" | "rewards" | "admin";

const BASE_URL = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

function unwrapError(result: any) {
  if (result?.error) throw new Error(result.error.message || result.error.code || "تعذر تنفيذ العملية");
  return result;
}

function Loading({ text = "جارٍ تحميل بنك التميز..." }: { text?: string }) {
  return <div className="full-center"><div className="loader" /><p>{text}</p></div>;
}

function AuthScreen() {
  const [mode, setMode] = useState<"otp" | "register" | "password">("otp");
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
        <button className={mode==="otp"?"active":""} onClick={()=>{setMode("otp");setMessage("")}}>دخول برمز البريد</button>
        <button className={mode==="password"?"active":""} onClick={()=>{setMode("password");setMessage("")}}>دخول بكلمة مرور</button>
        <button className={mode==="register"?"active":""} onClick={()=>{setMode("register");setMessage("")}}>إنشاء حساب معلم</button>
      </div>
      {mode==="otp" && (!otpSent ? <form onSubmit={sendOtp} className="form-stack">
        <h2>تسجيل الدخول</h2><p>مناسب أيضًا لحساب مدير النظام.</p>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
        <button className="btn primary" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال رمز الدخول"}</button>
      </form> : <form onSubmit={verifyOtp} className="form-stack">
        <h2>أدخل الرمز</h2><p>أرسلنا رمزًا إلى {email}</p>
        <label>رمز OTP<input inputMode="numeric" required value={otp} onChange={e=>setOtp(e.target.value)} placeholder="000000"/></label>
        <button className="btn primary" disabled={busy}>{busy?"جارٍ التحقق...":"دخول"}</button>
        <button type="button" className="btn ghost" onClick={()=>setOtpSent(false)}>تغيير البريد</button>
      </form>)}
      {mode==="password" && <form onSubmit={passwordLogin} className="form-stack"><h2>الدخول بكلمة المرور</h2>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>كلمة المرور<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="btn primary" disabled={busy}>دخول</button>
      </form>}
      {mode==="register" && <form onSubmit={register} className="form-stack"><h2>إنشاء حساب معلم</h2><p>إنشاء الحساب لا يمنح صلاحية إصدار الشيكات تلقائيًا؛ الإدارة تعتمدها من لوحة الصلاحيات.</p>
        <label>الاسم الكامل<input required value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>كلمة المرور<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <button className="btn primary" disabled={busy}>إنشاء الحساب</button>
      </form>}
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
  return <div className="full-center"><div className="pending-card"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span className="pending-icon">⏳</span><h1>الحساب بانتظار الصلاحية</h1><p>أهلًا {profile.name || profile.email}. تم تسجيل حسابك بنجاح، لكن إصدار شيكات التميز لن يعمل حتى تعتمد الإدارة حسابك كمعلم.</p><button className="btn primary" onClick={onRefresh}>تحديث حالة الحساب</button><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
}

function AppShell({ profile, children, tab, setTab }: { profile: Profile; children: any; tab: Tab; setTab:(t:Tab)=>void }) {
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  const nav:Array<[Tab,string,string]>=[["dashboard","الرئيسية","⌂"],["checks","شيكات التميز","▣"],["khameesna","خميسنا غير","🏆"],["students","الطلاب والمحافظ","◎"],["rankings","لوحة الترتيب","★"],["rewards","المكافآت","◇"]];
  if(isAdmin) nav.push(["admin","صلاحيات المعلمين","⚙"]);
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><b>بنك التميز</b><span>مدارس المشكاة الأهلية</span></div></div><nav>{nav.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}</button>)}</nav><div className="issuer-card"><small>المستخدم</small><b>{profile.name}</b><span>{profile.roles?.includes("TEACHER")?"معلم معتمد":"إدارة"}</span>{profile.can_issue && <><small>المتاح هذا الشهر</small><strong>{profile.is_unlimited?"غير محدود":profile.remaining ?? "—"} نقطة</strong></>}</div><button className="signout" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></aside><div className="main-area">{children}<footer><span>برمجة وتنفيذ: محمد صلاح الدين محمد الجمل</span><span>جميع الحقوق محفوظة © مدارس المشكاة الأهلية</span></footer></div></div>;
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
  return <><Header title="إصدار شيك تميز" subtitle="المعلم لا يستطيع الإصدار إلا بعد اعتماد الإدارة لصلاحيته"/><main className="content"><section className="grid-2"><form className="panel form-stack" onSubmit={submit}><h3>بيانات الشيك</h3><label>ابحث عن الطالب<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="الاسم أو رقم الطالب"/></label><label>الطالب<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">اختر الطالب</option>{filtered.map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade_name} / {s.class_name}</option>)}</select></label><label>فئة التميز<select required value={ruleId} onChange={e=>chooseRule(e.target.value)}><option value="">اختر الفئة</option>{rules.map(r=><option key={r.id} value={r.id}>{r.name_ar} ({r.default_points} نقاط){r.is_mega?" — شيك عملاق":""}</option>)}</select></label><div className="form-row"><label>النقاط<input type="number" required value={points} onChange={e=>setPoints(Number(e.target.value))}/></label><label>سبب الشيك<input required value={reason} onChange={e=>setReason(e.target.value)}/></label></div><label>ملاحظات<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label><button className="btn primary" disabled={busy}>{busy?"جارٍ الإصدار...":"إصدار شيك التميز"}</button>{message&&<div className="notice">{message}</div>}</form><section className="panel rule-panel"><h3>الفئات المتاحة لحسابك</h3>{rules.length?<div className="rules">{rules.map(r=><button key={r.id} className={ruleId===r.id?"rule active":"rule"} onClick={()=>chooseRule(r.id)}><b>{r.name_ar}</b><span>{r.default_points} نقاط</span>{r.is_mega&&<small>خاص بالإدارة والتوجيه</small>}</button>)}</div>:<Empty text="لا توجد فئات إصدار متاحة لهذه الصلاحية."/>}</section></section>{issued&&<section className="check-print panel"><div className="check-head"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>بنك التميز الطلابي</span><h2>شيك تميز</h2></div><b>{issued.serial_no}</b></div><div className="check-body"><div><small>الطالب</small><h2>{issued.student_name}</h2><small>سبب التميز</small><h3>{issued.reason}</h3><div className="big-points">+{issued.points} نقطة</div></div>{qr&&<div className="qr"><img src={qr}/><small>امسح للتحقق من الشيك</small></div>}</div><button className="btn ghost no-print" onClick={()=>window.print()}>طباعة الشيك</button></section>}</main></>;
}

function StudentsView({students}:{students:Student[]}){const[q,setQ]=useState("");const list=students.filter(s=>`${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}`.includes(q));const total=students.reduce((a,s)=>a+Number(s.points),0);return <><Header title="الطلاب والمحافظ" subtitle="الأرصدة ناتجة من دفتر الحركات ولا تُعدّل يدويًا"/><main className="content"><section className="stats-grid"><Stat label="إجمالي الطلاب" value={students.length}/><Stat label="طلاب لديهم نقاط" value={students.filter(s=>Number(s.points)>0).length}/><Stat label="إجمالي النقاط" value={total}/><Stat label="عدد الفصول" value={new Set(students.map(s=>`${s.grade_name}-${s.class_name}`)).size}/></section><section className="panel"><div className="panel-title"><h3>محافظ الطلاب</h3><input className="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث..."/></div><div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الرقم</th><th>الصف</th><th>الفصل</th><th>المستوى</th><th>الرصيد</th><th>القيمة</th></tr></thead><tbody>{list.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.student_no}</td><td>{s.grade_name}</td><td>{s.class_name}</td><td><span className="pill">{s.level}</span></td><td><b>{s.points} نقطة</b></td><td>{Number(s.value_sar).toLocaleString("ar-SA")} ر.س</td></tr>)}</tbody></table></div></section></main></>}

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

function AdminView({pending,users,staff,classes,reload}:{pending:PendingUser[];users:ManagedUser[];staff:StaffMember[];classes:AdminClass[];reload:()=>Promise<void>}){
  const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  const[draftStaff,setDraftStaff]=useState<Record<string,string>>({});
  const[draftClasses,setDraftClasses]=useState<Record<string,string[]>>({});
  const[draftLimit,setDraftLimit]=useState<Record<string,string>>({});
  const[editing,setEditing]=useState<string>("");const[editStaff,setEditStaff]=useState("");const[editClasses,setEditClasses]=useState<string[]>([]);const[staffAssignmentOpen,setStaffAssignmentOpen]=useState("");const[staffAssignmentClasses,setStaffAssignmentClasses]=useState<string[]>([]);
  const roleLabel=(r:string)=>({SUPER_ADMIN:"مدير النظام",SCHOOL_ADMIN:"إدارة المدرسة",PRINCIPAL:"مدير المدرسة",VICE_PRINCIPAL:"وكيل المدرسة",GUIDANCE_COUNSELOR:"موجه طلابي",TEACHER:"معلم"} as Record<string,string>)[r]||r;
  const selectedStaff=(id:string)=>staff.find(s=>s.id===id);
  function togglePending(uid:string,cid:string){setDraftClasses(v=>{const a=v[uid]||[];return {...v,[uid]:a.includes(cid)?a.filter(x=>x!==cid):[...a,cid]}})}
  function toggleEdit(cid:string){setEditClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}
  function openStaffAssignment(s:StaffMember){setStaffAssignmentOpen(s.id);setStaffAssignmentClasses(s.assigned_class_ids||[]);setMsg("")}
  function toggleStaffAssignment(cid:string){setStaffAssignmentClasses(a=>a.includes(cid)?a.filter(x=>x!==cid):[...a,cid])}
  async function saveStaffAssignment(){const s=staff.find(x=>x.id===staffAssignmentOpen);if(!s)return;if(!staffAssignmentClasses.length){setMsg("اختر فصلًا واحدًا على الأقل للمعلم.");return}setBusy(staffAssignmentOpen);try{await rpc("api_set_staff_classes",{p_staff_id:staffAssignmentOpen,p_class_ids:staffAssignmentClasses});setMsg("تم تسكين "+s.full_name_ar+" على الفصول المحددة. طلاب هذه الفصول أصبحوا نطاقه عند ربط حسابه.");setStaffAssignmentOpen("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function approve(u:PendingUser){const sid=draftStaff[u.auth_user_id];const member=selectedStaff(sid);const cids=draftClasses[u.auth_user_id]||[];if(!member){setMsg("اختر اسم الموظف من قائمة الهيئة أولًا.");return}if(member.job_title_ar==="معلم"&&!cids.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل قبل الاعتماد.");return}setBusy(u.auth_user_id);setMsg("");try{await rpc("api_approve_teacher_scoped",{p_auth_user_id:u.auth_user_id,p_staff_id:sid,p_monthly_limit:Number(draftLimit[u.auth_user_id]||100),p_class_ids:cids});setMsg("تم اعتماد وربط "+member.full_name_ar+" وتطبيق نطاق الفصول.");setDraftStaff(v=>({...v,[u.auth_user_id]:""}));setDraftClasses(v=>({...v,[u.auth_user_id]:[]}));await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function budget(u:ManagedUser){const raw=window.prompt("الحد الشهري الجديد لـ "+u.name,String(u.monthly_limit||100));if(!raw)return;try{await rpc("api_set_teacher_budget",{p_app_user_id:u.id,p_monthly_limit:Number(raw),p_unlimited:false});setMsg("تم تحديث حد الإصدار.");await reload()}catch(e){setMsg(niceError(e))}}
  function startEdit(u:ManagedUser){setEditing(u.id);setEditStaff(u.staff_id||"");setEditClasses(u.assigned_class_ids||[]);setMsg("")}
  async function saveScope(){const u=users.find(x=>x.id===editing);const member=selectedStaff(editStaff);if(!u||!member)return;if(member.job_title_ar==="معلم"&&!editClasses.length){setMsg("يجب تسكين المعلم في فصل واحد على الأقل.");return}setBusy(editing);try{await rpc("api_set_user_scope",{p_app_user_id:editing,p_staff_id:editStaff,p_class_ids:editClasses});setMsg("تم حفظ وظيفة وفصول "+member.full_name_ar+".");setEditing("");await reload()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  const freeStaff=staff.filter(s=>!s.linked);
  return <><Header title="الهيئة والصلاحيات" subtitle="ربط حساب الموظف بوظيفته وتحديد الفصول التي يستطيع التعامل معها"/><main className="content">
    <section className="permission-policy"><div><b>صلاحية المعلم مقيدة بالفصول</b><span>يرى طلاب فصوله فقط، ويصدر لهم فقط، ويضيف خميسنا غير لفصوله فقط.</span></div><div><b>خميسنا غير: مرة واحدة يوميًا</b><span>لا يستطيع نفس المعلم إضافة نقاط لنفس الفصل أكثر من مرة في اليوم.</span></div><div><b>الشيك العملاق</b><span>متاح فقط لمن تم ربطه وظيفيًا كمدير مدرسة أو وكيل مدرسة أو موجه طلابي.</span></div></section>
    <section className="panel"><div className="panel-title"><div><h3>طلبات اعتماد حسابات جديدة</h3><p>اربط الحساب بالاسم الرسمي من ملف الهيئة ثم حدد الفصول.</p></div><span className="counter">{pending.length}</span></div>{pending.length?<div className="approval-list">{pending.map(u=>{const sid=draftStaff[u.auth_user_id]||"";const member=selectedStaff(sid);const cids=draftClasses[u.auth_user_id]||[];return <article className="approval-card" key={u.auth_user_id}><div className="approval-head"><div><b>{u.name||"مستخدم جديد"}</b><small>{u.email}</small></div><span>بانتظار الاعتماد</span></div><div className="approval-fields"><label>الاسم من قائمة الهيئة<select value={sid} onChange={e=>setDraftStaff(v=>({...v,[u.auth_user_id]:e.target.value}))}><option value="">اختر الموظف</option>{freeStaff.map(s=><option key={s.id} value={s.id}>{s.full_name_ar} — {s.job_title_ar}{s.specialty_ar?" — "+s.specialty_ar:""}</option>)}</select></label><label>الحد الشهري<input type="number" min="1" value={draftLimit[u.auth_user_id]||"100"} onChange={e=>setDraftLimit(v=>({...v,[u.auth_user_id]:e.target.value}))}/></label></div>{member?.job_title_ar==="معلم"&&<div className="class-picker"><b>تسكين المعلم في الفصول</b><div>{classes.map(c=><label key={c.id} className={cids.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={cids.includes(c.id)} onChange={()=>togglePending(u.auth_user_id,c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div>}<button className="btn primary" disabled={busy===u.auth_user_id||!sid} onClick={()=>approve(u)}>{busy===u.auth_user_id?"جارٍ الاعتماد...":"اعتماد وربط الصلاحية"}</button></article>})}</div>:<Empty text="لا توجد طلبات حسابات جديدة."/>}</section>
    <section className="panel"><div className="panel-title"><div><h3>المستخدمون المعتمدون</h3><p>يمكن تعديل ربط الموظف والفصول في أي وقت.</p></div><span className="counter">{users.length}</span></div><div className="table-wrap"><table><thead><tr><th>المستخدم</th><th>الوظيفة الرسمية</th><th>الصلاحيات</th><th>الفصول المسندة</th><th>حد الإصدار</th><th></th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td><b>{u.name}</b><small className="table-sub">{u.email}</small></td><td>{u.job_title_ar||<span className="muted">غير مربوط بالهيئة</span>}</td><td>{u.roles.map(roleLabel).join("، ")}</td><td>{u.assigned_classes?.length?u.assigned_classes.join("، "):"—"}</td><td>{u.is_unlimited?"غير محدود":u.monthly_limit??"—"}</td><td><div className="row-actions"><button className="mini-btn" onClick={()=>startEdit(u)}>إدارة الوظيفة والفصول</button>{u.roles.includes("TEACHER")&&<button className="mini-btn" onClick={()=>budget(u)}>تعديل الحد</button>}</div></td></tr>)}</tbody></table></div></section>
    {editing&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تعديل نطاق المستخدم</h3><p>{users.find(u=>u.id===editing)?.email}</p></div><button className="mini-btn" onClick={()=>setEditing("")}>إغلاق</button></div><label className="scope-label">الاسم والوظيفة<select value={editStaff} onChange={e=>{setEditStaff(e.target.value);const m=selectedStaff(e.target.value);if(m?.job_title_ar!=="معلم")setEditClasses([])}}><option value="">اختر من الهيئة</option>{staff.filter(s=>!s.linked||s.linked_app_user_id===editing).map(s=><option key={s.id} value={s.id}>{s.full_name_ar} — {s.job_title_ar}{s.specialty_ar?" — "+s.specialty_ar:""}</option>)}</select></label>{selectedStaff(editStaff)?.job_title_ar==="معلم"&&<div className="class-picker"><b>الفصول المسموح بها</b><p>المعلم لن يرى أو يمنح نقاطًا لطلاب أي فصل غير محدد هنا.</p><div>{classes.map(c=><label key={c.id} className={editClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={editClasses.includes(c.id)} onChange={()=>toggleEdit(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div>}<button className="btn primary" disabled={busy===editing||!editStaff} onClick={saveScope}>{busy===editing?"جارٍ الحفظ...":"حفظ الوظيفة والفصول"}</button></section>}
    <section className="panel"><div className="panel-title"><div><h3>دليل الهيئة التعليمية والإدارية</h3><p>من هنا يتم تسكين المعلمين على الفصول مباشرة حتى قبل إنشاء حساباتهم.</p></div><span className="counter">{staff.length}</span></div><div className="staff-grid">{staff.map(s=><article className={s.linked?"staff-card linked":"staff-card"} key={s.id}><div><b>{s.full_name_ar}</b><span>{s.job_title_ar}</span></div>{s.job_title_ar==="معلم"?<small>{s.specialty_ar||s.teaching_subject_ar||"معلم"}</small>:<small>{s.job_title_ar}</small>}{s.job_title_ar==="معلم"&&<div className="staff-assigned-classes"><b>الفصول:</b><span>{s.assigned_classes?.length?s.assigned_classes.join("، "):"لم يتم التسكين بعد"}</span></div>}<em>{s.linked?"مرتبط بحساب":"غير مرتبط"}</em>{s.job_title_ar==="معلم"&&<button className="mini-btn" onClick={()=>openStaffAssignment(s)}>تسكين الفصول</button>}</article>)}</div></section>{staffAssignmentOpen&&<section className="panel scope-editor"><div className="panel-title"><div><h3>تسكين المعلم على الفصول</h3><p>{staff.find(s=>s.id===staffAssignmentOpen)?.full_name_ar}</p></div><button className="mini-btn" onClick={()=>setStaffAssignmentOpen("")}>إغلاق</button></div><div className="class-picker"><b>اختر فصلًا أو أكثر</b><p>بعد الحفظ سيُربط المعلم بهذه الفصول وطلابها عند إنشاء حسابه أو ربطه لاحقًا.</p><div>{classes.map(c=><label key={c.id} className={staffAssignmentClasses.includes(c.id)?"class-check active":"class-check"}><input type="checkbox" checked={staffAssignmentClasses.includes(c.id)} onChange={()=>toggleStaffAssignment(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div><button className="btn primary" disabled={busy===staffAssignmentOpen||!staffAssignmentClasses.length} onClick={saveStaffAssignment}>{busy===staffAssignmentOpen?"جارٍ الحفظ...":"حفظ تسكين المعلم"}</button></section>}
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>}

function BankApp({ profile, refreshProfile }: { profile: Profile; refreshProfile:()=>Promise<void> }) {
  const [tab,setTab]=useState<Tab>("dashboard"); const[khameesna,setKhameesna]=useState<KhameesnaBoard|null>(null); const [dashboard,setDashboard]=useState<Dashboard|null>(null); const[students,setStudents]=useState<Student[]>([]);const[rules,setRules]=useState<Rule[]>([]);const[checks,setChecks]=useState<Check[]>([]);const[rankings,setRankings]=useState<Rankings|null>(null);const[rewards,setRewards]=useState<Reward[]>([]);const[pending,setPending]=useState<PendingUser[]>([]);const[users,setUsers]=useState<ManagedUser[]>([]);const[staff,setStaff]=useState<StaffMember[]>([]);const[adminClasses,setAdminClasses]=useState<AdminClass[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);
  const isAdmin=profile.roles?.some(r=>["SUPER_ADMIN","SCHOOL_ADMIN","PRINCIPAL"].includes(r));
  async function loadAll(){setLoading(true);setError("");try{const [d,s,ru,c,ra,rw,kh]=await Promise.all([rpc<Dashboard>("api_dashboard"),rpc<Student[]>("api_students"),rpc<Rule[]>("api_point_rules"),rpc<Check[]>("api_recent_checks"),rpc<Rankings>("api_rankings"),rpc<Reward[]>("api_rewards"),rpc<KhameesnaBoard>("api_khameesna_board")]);setDashboard(d);setStudents(s);setRules(ru);setChecks(c);setRankings(ra);setRewards(rw);setKhameesna(kh);if(isAdmin){const[p,u,st,cl]=await Promise.all([rpc<PendingUser[]>("api_pending_users"),rpc<ManagedUser[]>("api_managed_users"),rpc<StaffMember[]>("api_staff_directory"),rpc<AdminClass[]>("api_admin_classes")]);setPending(p);setUsers(u);setStaff(st);setAdminClasses(cl)}}catch(e){setError(niceError(e))}finally{setLoading(false)}}
  useEffect(()=>{loadAll()},[profile.app_user_id]);
  async function afterIssued(){await Promise.all([loadAll(),refreshProfile()])}
  return <AppShell profile={profile} tab={tab} setTab={setTab}>{loading&&!dashboard?<Loading/>:<>{error&&<div className="notice error global-error">{error}</div>}{tab==="dashboard"&&<DashboardView data={dashboard} checks={checks}/>} {tab==="checks"&&<ChecksView students={students} rules={rules} onIssued={afterIssued}/>} {tab==="students"&&<StudentsView students={students}/>} {tab==="rankings"&&<RankingsView data={rankings}/>} {tab==="rewards"&&<RewardsView rewards={rewards}/>} {tab==="khameesna"&&<KhameesnaView data={khameesna} reload={loadAll}/>} {tab==="admin"&&isAdmin&&<AdminView pending={pending} users={users} staff={staff} classes={adminClasses} reload={loadAll}/>}</>}</AppShell>;
}

export default function App(){
  const verifyNonce=new URLSearchParams(window.location.search).get("verify");
  const sessionState=neon.auth.useSession();
  const [profile,setProfile]=useState<Profile|null>(null);const[profileError,setProfileError]=useState("");const[profileLoading,setProfileLoading]=useState(false);
  async function refreshProfile(){setProfileLoading(true);setProfileError("");try{setProfile(await rpc<Profile>("api_profile"))}catch(e){setProfileError(niceError(e))}finally{setProfileLoading(false)}}
  useEffect(()=>{if(sessionState?.data?.user?.id)refreshProfile();else setProfile(null)},[sessionState?.data?.user?.id]);
  if(verifyNonce)return <VerifyView nonce={verifyNonce}/>;
  if(sessionState?.isPending)return <Loading text="جارٍ التحقق من الجلسة..."/>;
  if(!sessionState?.data)return <AuthScreen/>;
  if(profileLoading&&!profile)return <Loading text="جارٍ تحميل صلاحيات الحساب..."/>;
  if(profileError&&!profile)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل الصلاحيات</h1><p>{profileError}</p><button className="btn primary" onClick={refreshProfile}>إعادة المحاولة</button><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
  if(!profile)return <Loading/>;
  if(profile.status!=="APPROVED")return <PendingAccount profile={profile} onRefresh={refreshProfile}/>;
  return <BankApp profile={profile} refreshProfile={refreshProfile}/>;
}

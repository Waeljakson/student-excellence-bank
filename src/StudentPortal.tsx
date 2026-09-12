import { useEffect, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";

const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

type PortalData = {
  student: { id:string; student_no:string; name:string; grade_name:string; class_name:string; points:number; value_sar:number };
  checks: Array<{ id:string; serial_no:string; points:number; reason:string; status:string; approval_status:string; issued_at:string; rule_name:string; issuer_name:string }>;
  announcements: Array<{ id:string; title_ar:string; body_ar:string; starts_at:string; ends_at?:string|null }>;
};

function date(v:string){return new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}

export default function StudentPortal(){
  const[data,setData]=useState<PortalData|null>(null);const[error,setError]=useState("");
  useEffect(()=>{rpc<PortalData>("api_student_portal").then(setData).catch(e=>setError(niceError(e)))},[]);
  if(error)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل بوابة الطالب</h1><p>{error}</p><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
  if(!data)return <div className="full-center"><div className="loader"/><p>جارٍ تحميل بوابة الطالب...</p></div>;
  const s=data.student;
  return <div className="student-portal">
    <header className="student-portal-head"><div className="student-brand"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>مدارس المشكاة الأهلية</span><h1>بوابة الطالب — بنك التميز</h1></div></div><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></header>
    <main className="student-portal-content">
      <section className="student-welcome"><div><span>أهلًا بك</span><h2>{s.name}</h2><p>{s.grade_name} — فصل {s.class_name} · رقم الطالب {s.student_no}</p></div><div className="student-balance"><small>رصيدك الحالي</small><strong>{Number(s.points).toLocaleString("ar-SA")}</strong><span>نقطة · {Number(s.value_sar).toLocaleString("ar-SA")} ر.س</span></div></section>

      <section className="student-portal-grid">
        <article className="portal-panel"><div className="portal-panel-title"><h3>شيكات التميز الخاصة بي</h3><span>{data.checks.length}</span></div>{data.checks.length?<div className="student-checks">{data.checks.map(c=><div className="student-check-card" key={c.id}><div><b>{c.rule_name}</b><small>{c.reason}</small><em>{date(c.issued_at)} · {c.issuer_name}</em></div><strong>+{c.points}</strong><span>{c.serial_no}</span></div>)}</div>:<div className="empty">لم يصدر لك أي شيك تميز حتى الآن.</div>}</article>

        <article className="portal-panel"><div className="portal-panel-title"><h3>المسابقات المعلنة</h3><span>{data.announcements.length}</span></div>{data.announcements.length?<div className="announcement-list">{data.announcements.map(a=><div className="announcement-card" key={a.id}><span>مسابقة</span><h4>{a.title_ar}</h4><p>{a.body_ar}</p><small>تاريخ الإعلان: {date(a.starts_at)}{a.ends_at?` · حتى ${date(a.ends_at)}`:""}</small></div>)}</div>:<div className="empty">لا توجد مسابقات معلنة حاليًا.</div>}</article>
      </section>

      <p className="student-security-note">لن تظهر هنا إلا المسابقات التي تنشرها إدارة النظام للطلاب. بيانات الدخول شخصية ولا يجب مشاركتها.</p>
    </main>
  </div>;
}

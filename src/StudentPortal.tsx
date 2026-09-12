import { useEffect, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";

const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

type PortalData = {
  student: { id:string; student_no:string; name:string; grade_name:string; class_name:string; points:number; value_sar:number };
  checks: Array<{ id:string; serial_no:string; points:number; reason:string; status:string; approval_status:string; issued_at:string; rule_name:string; issuer_name:string }>;
  announcements: Array<{ id:string; title_ar:string; body_ar:string; starts_at:string; ends_at?:string|null }>;
  competitions: Array<{ id:string; name_ar:string; description_ar:string; starts_on:string; ends_on:string; reward_text_ar:string; week_no:number; display_status:string; criteria:Array<{key:string;label:string;weight:number;max_score:number}> }>;
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

        <article className="portal-panel"><div className="portal-panel-title"><h3>إعلانات المسابقات</h3><span>{data.announcements.length}</span></div>{data.announcements.length?<div className="announcement-list">{data.announcements.map(a=><div className="announcement-card" key={a.id}><span>إعلان</span><h4>{a.title_ar}</h4><p>{a.body_ar}</p><small>{date(a.starts_at)}</small></div>)}</div>:<div className="empty">لا توجد إعلانات مسابقات منشورة حاليًا.</div>}</article>
      </section>

      <section className="portal-panel competitions-panel"><div className="portal-panel-title"><div><h3>خميسنا غير</h3><p>من الأسبوع الخامس إلى الأسبوع السابع عشر</p></div><span>🏆</span></div><div className="student-competition-weeks">{data.competitions.map(c=><article key={c.id} className={`student-week-card ${c.display_status.toLowerCase()}`}><div className="week-number">الأسبوع {c.week_no}</div><h4>{c.name_ar}</h4><small>{date(c.starts_on)} — {date(c.ends_on)}</small><p>{c.description_ar}</p><div className="criteria-mini">{(c.criteria||[]).map(m=><span key={m.key}>{m.label}</span>)}</div><b>{c.reward_text_ar}</b></article>)}</div></section>
      <p className="student-security-note">بيانات الدخول شخصية. لا تشارك رقمك وكلمة مرورك مع أي طالب آخر.</p>
    </main>
  </div>;
}

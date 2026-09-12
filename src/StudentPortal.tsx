import { FormEvent, useEffect, useState } from "react";
import { neon, niceError, rpc } from "./client";
import "./feature-upgrade.css";
import "./student-account.css";
import "./targeted-competitions.css";

const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

type PortalAnnouncement={ id:string; title_ar:string; body_ar:string; starts_at:string; ends_at?:string|null; announcement_type?:string; criteria?:string[]; target_class_ids?:string[] };
type PortalData = {
  student: { id:string; student_no:string; name:string; grade_name:string; class_name:string; points:number; value_sar:number; avatar?:string|null };
  checks: Array<{ id:string; serial_no:string; points:number; reason:string; status:string; approval_status:string; issued_at:string; rule_name:string; issuer_name:string }>;
  announcements: PortalAnnouncement[];
};

function date(v:string){return new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}
function authError(result:any){if(result?.error)throw new Error(result.error.message||result.error.code||"تعذر تنفيذ العملية")}

async function prepareAvatar(file:File){
  if(!file.type.startsWith("image/"))throw new Error("اختر ملف صورة فقط.");
  if(file.size>5*1024*1024)throw new Error("حجم الصورة الأصلي يجب ألا يتجاوز 5 ميجابايت.");
  const source=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("تعذر قراءة الصورة."));r.readAsDataURL(file)});
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("تعذر فتح الصورة."));i.src=source});
  const size=360;const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("تعذر تجهيز الصورة.");
  const scale=Math.max(size/img.width,size/img.height);const w=img.width*scale;const h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
  return canvas.toDataURL("image/jpeg",0.78);
}

export default function StudentPortal(){
  const[data,setData]=useState<PortalData|null>(null);const[error,setError]=useState("");
  const[photoBusy,setPhotoBusy]=useState(false);const[photoMsg,setPhotoMsg]=useState("");
  const[currentPassword,setCurrentPassword]=useState("");const[newPassword,setNewPassword]=useState("");const[confirmPassword,setConfirmPassword]=useState("");const[passwordBusy,setPasswordBusy]=useState(false);const[passwordMsg,setPasswordMsg]=useState("");
  async function load(){setError("");try{setData(await rpc<PortalData>("api_student_portal"))}catch(e){setError(niceError(e))}}
  useEffect(()=>{load()},[]);

  async function uploadPhoto(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;setPhotoBusy(true);setPhotoMsg("");
    try{const image=await prepareAvatar(file);const result=await neon.auth.updateUser({image});authError(result);await load();setPhotoMsg("تم تحديث صورتك الشخصية.");}
    catch(err){setPhotoMsg(niceError(err))}finally{setPhotoBusy(false);e.target.value=""}
  }

  async function changePassword(e:FormEvent){
    e.preventDefault();setPasswordMsg("");
    if(newPassword.length<8){setPasswordMsg("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");return}
    if(newPassword!==confirmPassword){setPasswordMsg("تأكيد كلمة المرور غير مطابق.");return}
    if(currentPassword===newPassword){setPasswordMsg("اختر كلمة مرور جديدة مختلفة عن الحالية.");return}
    setPasswordBusy(true);
    try{const result=await neon.auth.changePassword({currentPassword,newPassword,revokeOtherSessions:true});authError(result);setCurrentPassword("");setNewPassword("");setConfirmPassword("");setPasswordMsg("تم تغيير كلمة المرور بنجاح. استخدم كلمة المرور الجديدة في الدخول القادم.");}
    catch(err){setPasswordMsg(niceError(err))}finally{setPasswordBusy(false)}
  }

  if(error)return <div className="full-center"><div className="pending-card"><h1>تعذر تحميل بوابة الطالب</h1><p>{error}</p><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></div></div>;
  if(!data)return <div className="full-center"><div className="loader"/><p>جارٍ تحميل بوابة الطالب...</p></div>;
  const s=data.student;
  const competitions=data.announcements.filter(a=>a.announcement_type==="TARGETED_COMPETITION");
  const announcements=data.announcements.filter(a=>a.announcement_type!=="TARGETED_COMPETITION");
  return <div className="student-portal">
    <header className="student-portal-head"><div className="student-brand"><div className="logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><div><span>مدارس المشكاة الأهلية</span><h1>بوابة الطالب — بنك التميز</h1></div></div><button className="btn ghost" onClick={()=>neon.auth.signOut()}>تسجيل الخروج</button></header>
    <main className="student-portal-content">
      <section className="student-welcome student-profile-welcome"><div className="student-profile-main"><div className="student-avatar">{s.avatar?<img src={s.avatar} alt="الصورة الشخصية"/>:<span>{s.name?.trim()?.charAt(0)||"ط"}</span>}</div><div><span>أهلًا بك</span><h2>{s.name}</h2><p>{s.grade_name} — فصل {s.class_name} · رقم الطالب {s.student_no}</p></div></div><div className="student-balance"><small>رصيدك الحالي</small><strong>{Number(s.points).toLocaleString("ar-SA")}</strong><span>نقطة · {Number(s.value_sar).toLocaleString("ar-SA")} ر.س</span></div></section>

      {competitions.length>0&&<section className="student-competition-banners">{competitions.map((c,index)=><article className="competition-check-banner" key={c.id}><div className="check-perforation top"/><div className="competition-check-side"><div className="competition-check-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span>مسابقة مدرسية</span><b>{String(index+1).padStart(2,"0")}</b></div><div className="competition-check-main"><div className="competition-check-kicker"><span>تم إطلاق المسابقة لفصلك</span><em>نشطة الآن</em></div><h2>{c.title_ar}</h2><p>{c.body_ar}</p>{c.criteria?.length?<div className="competition-check-criteria">{c.criteria.map((criterion,i)=><span key={i}><b>{i+1}</b>{criterion}</span>)}</div>:null}<div className="competition-check-footer"><div><small>تبدأ</small><b>{date(c.starts_at)}</b></div><div><small>تنتهي</small><b>{c.ends_at?date(c.ends_at):"حتى إشعار آخر"}</b></div><div><small>الفصل المستهدف</small><b>{s.grade_name} — فصل {s.class_name}</b></div></div></div><div className="check-perforation bottom"/></article>)}</section>}

      <section className="portal-panel student-account-panel"><div className="portal-panel-title"><div><h3>إعدادات حسابي</h3><p>الصورة الشخصية وكلمة المرور</p></div><span>⚙</span></div><div className="student-account-grid">
        <div className="student-photo-settings"><div className="student-avatar large">{s.avatar?<img src={s.avatar} alt="الصورة الشخصية"/>:<span>{s.name?.trim()?.charAt(0)||"ط"}</span>}</div><div><h4>صورتي الشخصية</h4><p>اختر صورة واضحة. سيتم قصها وضغطها تلقائيًا.</p><label className={`btn primary upload-avatar-btn ${photoBusy?"disabled":""}`}>{photoBusy?"جارٍ حفظ الصورة...":"اختيار صورة"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={uploadPhoto}/></label>{photoMsg&&<div className="notice compact-notice">{photoMsg}</div>}</div></div>
        <form className="student-password-form form-stack" onSubmit={changePassword}><h4>تغيير كلمة المرور</h4><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button className="btn primary" disabled={passwordBusy}>{passwordBusy?"جارٍ التغيير...":"تغيير كلمة المرور"}</button>{passwordMsg&&<div className="notice compact-notice">{passwordMsg}</div>}</form>
      </div></section>

      <section className="student-portal-grid">
        <article className="portal-panel"><div className="portal-panel-title"><h3>شيكات التميز الخاصة بي</h3><span>{data.checks.length}</span></div>{data.checks.length?<div className="student-checks">{data.checks.map(c=><div className="student-check-card" key={c.id}><div><b>{c.rule_name}</b><small>{c.reason}</small><em>{date(c.issued_at)} · {c.issuer_name}</em></div><strong>+{c.points}</strong><span>{c.serial_no}</span></div>)}</div>:<div className="empty">لم يصدر لك أي شيك تميز حتى الآن.</div>}</article>
        <article className="portal-panel"><div className="portal-panel-title"><h3>الإعلانات العامة</h3><span>{announcements.length}</span></div>{announcements.length?<div className="announcement-list">{announcements.map(a=><div className="announcement-card" key={a.id}><span>إعلان</span><h4>{a.title_ar}</h4><p>{a.body_ar}</p><small>تاريخ الإعلان: {date(a.starts_at)}{a.ends_at?` · حتى ${date(a.ends_at)}`:""}</small></div>)}</div>:<div className="empty">لا توجد إعلانات عامة حاليًا.</div>}</article>
      </section>

      <p className="student-security-note">لا تظهر لك إلا المسابقات الموجهة لفصلك خلال فترة إطلاقها. بيانات الدخول شخصية ولا يجب مشاركتها.</p>
    </main>
  </div>;
}

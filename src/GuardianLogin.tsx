import {FormEvent,useState} from "react";
import {niceError,rpc} from "./client";
import GuardianPortal from "./GuardianPortal";

function normalizeStudentNo(value:string){
  const ar="٠١٢٣٤٥٦٧٨٩", fa="۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g,ch=>String(ar.indexOf(ch)))
    .replace(/[۰-۹]/g,ch=>String(fa.indexOf(ch)))
    .replace(/\D/g,"");
}

function LoginForm({onSuccess}:{onSuccess:(studentNo:string)=>void}){
  const[studentNo,setStudentNo]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function submit(e:FormEvent){
    e.preventDefault();
    const no=normalizeStudentNo(studentNo);
    setBusy(true);setMsg("");
    try{
      if(!/^\d{10}$/.test(no))throw new Error("اكتب رقم هوية / رقم الطالب المكوّن من 10 أرقام.");
      await rpc("api_guardian_portal_by_student_no",{p_student_no:no});
      onSuccess(no);
    }catch(err){
      const m=niceError(err);
      setMsg(m.includes("STUDENT_NOT_FOUND")?"لم يتم العثور على طالب بهذا الرقم. تأكد من الرقم المسجل بالمدرسة.":m);
    }finally{setBusy(false)}
  }

  return <form onSubmit={submit} className="form-stack">
    <h2>بوابة ولي الأمر</h2>
    <p>أدخل <b>رقم هوية / رقم الطالب المسجل بالمدرسة</b> فقط. لا تحتاج إلى كلمة مرور.</p>
    <label>رقم هوية / رقم الطالب
      <input inputMode="numeric" autoComplete="off" maxLength={10} required value={studentNo} onChange={e=>setStudentNo(e.target.value)} placeholder="10 أرقام"/>
    </label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ فتح البوابة...":"دخول ولي الأمر"}</button>
    {msg&&<div className="notice error">{msg}</div>}
    <small>الرابط موحّد لجميع أولياء الأمور، وكل ولي أمر يدخل برقم ابنه فقط.</small>
  </form>;
}

export default function GuardianLogin({standalone=false}:{standalone?:boolean}){
  const[studentNo,setStudentNo]=useState("");
  if(studentNo)return <GuardianPortal studentNo={studentNo}/>;
  if(!standalone)return <LoginForm onSuccess={setStudentNo}/>;
  return <div className="auth-page">
    <div className="auth-brand">
      <span>مدارس المشكاة الأهلية</span>
      <h1>بوابة ولي الأمر</h1>
      <p>متابعة يومية لملاحظات المعلمين والتقييمات والتميز الطلابي.</p>
    </div>
    <div className="auth-card"><LoginForm onSuccess={setStudentNo}/></div>
  </div>;
}

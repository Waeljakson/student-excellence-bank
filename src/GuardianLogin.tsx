import {FormEvent,useState} from "react";
import {niceError,rpc} from "./client";
import GuardianPortal from "./GuardianPortal";

const SCHOOL_LOGO=`${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO=`${import.meta.env.BASE_URL}guidance-logo.png`;

function normalizeStudentNo(value:string){
  const ar="٠١٢٣٤٥٦٧٨٩", fa="۰۱۲۳۴۵۶۷۸۹";
  return value
    .replace(/[٠-٩]/g,ch=>String(ar.indexOf(ch)))
    .replace(/[۰-۹]/g,ch=>String(fa.indexOf(ch)))
    .replace(/\D/g,"");
}

function LoginForm({onSuccess}:{onSuccess:(studentNo:string,data:any)=>void}){
  const[studentNo,setStudentNo]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function submit(e:FormEvent){
    e.preventDefault();
    const no=normalizeStudentNo(studentNo);
    setBusy(true);setMsg("");
    try{
      if(!/^\d{10}$/.test(no))throw new Error("اكتب رقم هوية / رقم الطالب المكوّن من 10 أرقام.");
      const lookup=await rpc<any>("api_guardian_lookup",{p_mobile:no});
      if(!lookup?.exists||lookup?.source!=="student_no"||!lookup?.portal)throw new Error("STUDENT_NOT_FOUND");
      onSuccess(no,lookup.portal);
    }catch(err){
      const m=niceError(err);
      setMsg(m.includes("STUDENT_NOT_FOUND")?"لم يتم العثور على طالب بهذا الرقم. تأكد من الرقم المسجل بالمدرسة.":m);
    }finally{setBusy(false)}
  }

  return <form onSubmit={submit} className="form-stack guardian-login-form">
    <div className="guardian-login-title">
      <div className="guardian-login-logos"><img src={SCHOOL_LOGO} alt="شعار المدرسة"/><img src={GUIDANCE_LOGO} alt="شعار التوجيه الطلابي"/></div>
      <span>متوسطة وثانوية مشكاة الشعلة</span>
      <h2>بوابة ولي الأمر</h2>
    </div>
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
  const[portalData,setPortalData]=useState<any>(null);
  function success(no:string,data:any){setStudentNo(no);setPortalData(data)}
  if(studentNo&&portalData)return <GuardianPortal studentNo={studentNo} initialData={portalData}/>;
  if(!standalone)return <LoginForm onSuccess={success}/>;
  return <div className="auth-page">
    <div className="auth-brand guardian-public-brand">
      <div className="logos"><img src={SCHOOL_LOGO} alt="شعار المدرسة"/><img src={GUIDANCE_LOGO} alt="شعار التوجيه الطلابي"/></div>
      <span>متوسطة وثانوية مشكاة الشعلة</span>
      <h1>بوابة ولي الأمر</h1>
      <p>متابعة يومية لملاحظات المعلمين والتقييمات والتميز الطلابي.</p>
    </div>
    <div className="auth-card"><LoginForm onSuccess={success}/></div>
  </div>;
}

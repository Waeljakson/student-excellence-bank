import { FormEvent, useMemo, useState } from "react";
import { AUTH_URL } from "./client";

async function postJson(path:string, body:Record<string,unknown>){
  const res=await fetch(`${AUTH_URL}${path}`,{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
  });
  let data:any={};
  try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data?.message||data?.error||"تعذر تنفيذ العملية");
  return data;
}

export default function AdminPasswordReset(){
  const params=useMemo(()=>new URLSearchParams(window.location.search),[]);
  const token=params.get("token")||"";
  const tokenError=params.get("error")||"";
  const[email,setEmail]=useState("waeljaksonstar@gmail.com");
  const[newPassword,setNewPassword]=useState("");
  const[confirm,setConfirm]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState(tokenError?"رابط إعادة التعيين غير صالح أو منتهي.":"");

  async function requestReset(e:FormEvent){
    e.preventDefault();
    setBusy(true);setMsg("");
    try{
      const redirectTo=`${window.location.origin}${import.meta.env.BASE_URL}`;
      await postJson("/request-password-reset",{email:email.trim(),redirectTo});
      setMsg("تم إرسال رابط تعيين كلمة المرور إلى البريد الإلكتروني. افتح الرسالة ثم ارجع للنظام من الرابط الموجود بها.");
    }catch(err:any){setMsg(err?.message||"تعذر إرسال رابط إعادة التعيين.")}finally{setBusy(false)}
  }

  async function resetPassword(e:FormEvent){
    e.preventDefault();
    if(newPassword.length<8){setMsg("كلمة المرور يجب ألا تقل عن 8 أحرف.");return}
    if(newPassword!==confirm){setMsg("تأكيد كلمة المرور غير مطابق.");return}
    setBusy(true);setMsg("");
    try{
      await postJson("/reset-password",{newPassword,token});
      setMsg("تم تعيين كلمة المرور بنجاح. يمكنك الآن الدخول من تبويب دخول الإدارة.");
      window.history.replaceState({},"",import.meta.env.BASE_URL);
      setNewPassword("");setConfirm("");
    }catch(err:any){setMsg(err?.message||"تعذر تعيين كلمة المرور.")}finally{setBusy(false)}
  }

  if(token) return <form onSubmit={resetPassword} className="form-stack" style={{marginTop:12}}>
    <h3>تعيين كلمة المرور</h3>
    <p>اكتب كلمة المرور الجديدة ثم احفظها.</p>
    <label>كلمة المرور الجديدة<input type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
    <label>تأكيد كلمة المرور<input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <button className="btn primary" disabled={busy}>{busy?"جارٍ الحفظ...":"حفظ كلمة المرور"}</button>
    {msg&&<div className="notice">{msg}</div>}
  </form>;

  return <form onSubmit={requestReset} className="form-stack" style={{marginTop:12}}>
    <h3>تعيين أو إعادة تعيين كلمة المرور</h3>
    <p>يُستخدم مرة واحدة عند تفعيل الدخول بكلمة مرور أو عند نسيانها.</p>
    <label>البريد الإلكتروني<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <button className="btn ghost" disabled={busy}>{busy?"جارٍ الإرسال...":"إرسال رابط تعيين كلمة المرور"}</button>
    {msg&&<div className="notice">{msg}</div>}
  </form>;
}

import { FormEvent, useState } from "react";
import { neon, niceError } from "./client";
import "./user-account.css";

const SCHOOL_LOGO = `${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO = `${import.meta.env.BASE_URL}guidance-logo.png`;

type UserProfile = {
  name?: string;
  email?: string;
  avatar?: string | null;
  roles?: string[];
};

const roleLabels: Record<string,string> = {
  SUPER_ADMIN: "مدير النظام",
  SCHOOL_ADMIN: "إدارة المدرسة",
  PRINCIPAL: "مدير المدرسة",
  VICE_PRINCIPAL: "وكيل المدرسة",
  GUIDANCE_COUNSELOR: "موجه طلابي",
  TEACHER: "معلم",
  REWARD_OFFICER: "مسؤول المكافآت",
  GUARDIAN: "ولي أمر",
};

function authError(result:any){
  if(result?.error) throw new Error(result.error.message || result.error.code || "تعذر تنفيذ العملية");
}

async function prepareAvatar(file:File){
  if(!file.type.startsWith("image/")) throw new Error("اختر ملف صورة فقط.");
  if(file.size > 5*1024*1024) throw new Error("حجم الصورة الأصلي يجب ألا يتجاوز 5 ميجابايت.");
  const source = await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error("تعذر فتح الصورة."));
    image.src=source;
  });
  const size=360;
  const canvas=document.createElement("canvas");
  canvas.width=size; canvas.height=size;
  const ctx=canvas.getContext("2d");
  if(!ctx) throw new Error("تعذر تجهيز الصورة.");
  const scale=Math.max(size/img.width,size/img.height);
  const w=img.width*scale, h=img.height*scale;
  ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
  return canvas.toDataURL("image/jpeg",0.78);
}

export default function UserAccount({profile,onProfileChanged}:{profile:UserProfile;onProfileChanged:()=>Promise<void>}){
  const[photoBusy,setPhotoBusy]=useState(false);
  const[photoMsg,setPhotoMsg]=useState("");
  const[currentPassword,setCurrentPassword]=useState("");
  const[newPassword,setNewPassword]=useState("");
  const[confirmPassword,setConfirmPassword]=useState("");
  const[passwordBusy,setPasswordBusy]=useState(false);
  const[passwordMsg,setPasswordMsg]=useState("");

  async function uploadPhoto(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file) return;
    setPhotoBusy(true); setPhotoMsg("");
    try{
      const image=await prepareAvatar(file);
      const result=await neon.auth.updateUser({image});
      authError(result);
      await onProfileChanged();
      setPhotoMsg("تم تحديث صورتك الشخصية.");
    }catch(err){setPhotoMsg(niceError(err))}
    finally{setPhotoBusy(false);e.target.value=""}
  }

  async function changePassword(e:FormEvent){
    e.preventDefault(); setPasswordMsg("");
    if(newPassword.length<8){setPasswordMsg("كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");return}
    if(newPassword!==confirmPassword){setPasswordMsg("تأكيد كلمة المرور غير مطابق.");return}
    if(currentPassword===newPassword){setPasswordMsg("اختر كلمة مرور جديدة مختلفة عن الحالية.");return}
    setPasswordBusy(true);
    try{
      const result=await neon.auth.changePassword({currentPassword,newPassword,revokeOtherSessions:true});
      authError(result);
      setCurrentPassword("");setNewPassword("");setConfirmPassword("");
      setPasswordMsg("تم تغيير كلمة المرور بنجاح. استخدم كلمة المرور الجديدة في الدخول القادم.");
    }catch(err){setPasswordMsg(niceError(err))}
    finally{setPasswordBusy(false)}
  }

  const initial=profile.name?.trim()?.charAt(0)||"م";
  const roles=(profile.roles||[]).map(r=>roleLabels[r]||r).join("، ")||"مستخدم";

  return <><header className="topbar"><div><h1>حسابي</h1><p>إدارة الصورة الشخصية وكلمة المرور</p></div><div className="header-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div></header><main className="content user-account-page">
    <section className="user-account-hero"><div className="user-account-avatar hero-avatar">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{initial}</span>}</div><div><span>الحساب الشخصي</span><h2>{profile.name||"مستخدم"}</h2><p>{profile.email}</p><small>{roles}</small></div></section>
    <section className="user-account-grid">
      <article className="panel user-photo-card"><div className="user-account-avatar large">{profile.avatar?<img src={profile.avatar} alt="الصورة الشخصية"/>:<span>{initial}</span>}</div><div><h3>الصورة الشخصية</h3><p>اختر صورة واضحة. سيتم قصها وضغطها تلقائيًا قبل الحفظ.</p><label className={`btn primary account-upload-btn ${photoBusy?"disabled":""}`}>{photoBusy?"جارٍ حفظ الصورة...":"اختيار صورة"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={uploadPhoto}/></label>{photoMsg&&<div className="notice account-notice">{photoMsg}</div>}</div></article>
      <form className="panel form-stack user-password-card" onSubmit={changePassword}><div><h3>تغيير كلمة المرور</h3><p>أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة لا تقل عن 8 أحرف.</p></div><label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label><label>تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button className="btn primary" disabled={passwordBusy}>{passwordBusy?"جارٍ التغيير...":"تغيير كلمة المرور"}</button>{passwordMsg&&<div className="notice account-notice">{passwordMsg}</div>}</form>
    </section>
    <section className="panel user-security-card"><b>أمان الحساب</b><p>الصورة وكلمة المرور تخص حسابك فقط. عند تغيير كلمة المرور يتم إنهاء الجلسات الأخرى للحساب.</p></section>
  </main></>;
}

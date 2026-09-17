import {FormEvent,useState} from "react";
import {neon,niceError,rpc} from "./client";

function normalizeMobile(value:string){
  let m=value.replace(/\D/g,"");
  if(m.startsWith("009665"))m="0"+m.slice(4);
  else if(m.startsWith("9665"))m="0"+m.slice(3);
  else if(m.length===9&&m.startsWith("5"))m="0"+m;
  return m;
}
function authError(result:any){if(result?.error)throw new Error(result.error.message||result.error.code||"تعذر تسجيل الدخول")}

export default function GuardianLogin(){
  const[mobile,setMobile]=useState("");const[password,setPassword]=useState("");const[busy,setBusy]=useState(false);const[msg,setMsg]=useState("");
  async function submit(e:FormEvent){
    e.preventDefault();const m=normalizeMobile(mobile);setBusy(true);setMsg("");
    try{
      if(!/^05\d{8}$/.test(m))throw new Error("اكتب رقم الجوال السعودي بصيغة صحيحة مثل 05xxxxxxxx.");
      const lookup=await rpc<any>("api_guardian_lookup",{p_mobile:m});
      if(!lookup.exists)throw new Error("رقم الجوال غير مرتبط بطالب في النظام.");
      const canonical=String(lookup.mobile||m);const email=`${canonical}@parents.mishkat.sa`;
      if(lookup.claimed){const r=await neon.auth.signIn.email({email,password});authError(r);window.dispatchEvent(new Event("mishkat-auth-success"));return}
      if(password!==`${canonical}Aa`)throw new Error("كلمة المرور الافتراضية هي رقم الجوال متبوعًا بـ Aa.");
      let signedIn=false;
      try{const r=await neon.auth.signUp.email({name:`ولي أمر ${canonical}`,email,password});authError(r);signedIn=true}catch(createErr){try{const r=await neon.auth.signIn.email({email,password});authError(r);signedIn=true}catch{throw createErr}}
      if(!signedIn)throw new Error("تعذر إنشاء حساب ولي الأمر.");
      try{const r=await neon.auth.signIn.email({email,password});authError(r)}catch{}
      await rpc("api_claim_guardian_account",{p_mobile:canonical});
      window.dispatchEvent(new Event("mishkat-auth-success"));
    }catch(err){setMsg(niceError(err))}finally{setBusy(false)}
  }
  return <form onSubmit={submit} className="form-stack"><h2>دخول ولي الأمر</h2><p>اسم المستخدم هو <b>رقم جوال الطالب المسجل بالمدرسة</b>. كلمة المرور الافتراضية: رقم الجوال متبوعًا بـ <b>Aa</b>.</p><label>رقم جوال الطالب<input inputMode="tel" autoComplete="username" required value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="05xxxxxxxx" /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="رقم الجوال + Aa" /></label><button className="btn primary" disabled={busy}>{busy?"جارٍ الدخول...":"دخول ولي الأمر"}</button>{msg&&<div className="notice">{msg}</div>}</form>
}

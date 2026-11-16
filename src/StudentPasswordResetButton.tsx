import {useState} from "react";
import {AUTH_URL,niceError,rpc} from "./client";
import "./student-password-reset.css";

type StudentLite={id:string;name:string;student_no:string};
type Target={
  student_id:string;
  student_no:string;
  student_name:string;
  auth_user_id?:string|null;
  claimed:boolean;
};

export default function StudentPasswordResetButton({student}:{student:StudentLite}){
  const[open,setOpen]=useState(false);
  const[busy,setBusy]=useState(false);
  const[target,setTarget]=useState<Target|null>(null);
  const[msg,setMsg]=useState("");
  const[done,setDone]=useState(false);

  async function show(){
    setOpen(true);setBusy(true);setMsg("");setDone(false);setTarget(null);
    try{
      const t=await rpc<Target>("api_admin_student_auth_target",{p_student_id:student.id});
      setTarget(t);
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  async function reset(){
    if(!target?.claimed||!target.auth_user_id)return;
    const newPassword=target.student_no+"Aa";
    const ok=window.confirm(
      "سيتم إعادة كلمة مرور الطالب «"+target.student_name+"» إلى كلمة المرور الافتراضية:\n\n"+
      newPassword+"\n\nهل تريد المتابعة؟"
    );
    if(!ok)return;
    setBusy(true);setMsg("");setDone(false);
    try{
      const res=await fetch(AUTH_URL+"/admin/set-user-password",{
        method:"POST",
        credentials:"include",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({userId:target.auth_user_id,newPassword})
      });
      let body:any={};try{body=await res.json()}catch{}
      if(!res.ok)throw new Error(body?.message||body?.error||"تعذر إعادة كلمة المرور.");
      setDone(true);
      setMsg("تمت إعادة كلمة المرور بنجاح.");
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  const defaultPassword=(target?.student_no||student.student_no)+"Aa";

  return <>
    <button type="button" className="student-password-reset-btn" onClick={()=>void show()}>
      استعادة كلمة المرور
    </button>

    {open&&<div className="student-password-reset-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
      <section className="student-password-reset-card" dir="rtl">
        <button className="student-password-reset-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <div className="student-password-reset-icon">🔐</div>
        <h3>استعادة كلمة مرور الطالب</h3>
        <p className="student-password-reset-name">{student.name}</p>

        {busy&&!target?<div className="student-password-reset-loading">جارٍ التحقق من حساب الطالب...</div>:null}

        {target&&<>
          <div className="student-password-reset-credentials">
            <div><span>اسم المستخدم</span><b>{target.student_no}</b></div>
            <div><span>كلمة المرور الافتراضية</span><b dir="ltr">{defaultPassword}</b></div>
          </div>

          {!target.claimed?
            <div className="notice student-password-reset-info">
              لم يسبق للطالب تفعيل حسابه. لا يحتاج إلى إعادة تعيين كلمة المرور؛ يمكنه تسجيل الدخول مباشرة باستخدام رقم الطالب وكلمة المرور الافتراضية الموضحة أعلاه.
            </div>
          :
            <div className="student-password-reset-warning">
              <b>تنبيه</b>
              <p>سيتم استبدال كلمة المرور الحالية بكلمة المرور الافتراضية. لن تتأثر بيانات الطالب أو نقاطه أو تقاريره.</p>
            </div>
          }

          {msg&&<div className={"notice "+(done?"student-password-reset-success":"")}>{msg}</div>}

          <div className="student-password-reset-actions">
            <button type="button" className="btn ghost" onClick={()=>setOpen(false)} disabled={busy}>إغلاق</button>
            {target.claimed&&<button type="button" className="btn primary" onClick={()=>void reset()} disabled={busy||done}>
              {busy?"جارٍ إعادة التعيين...":done?"تمت الاستعادة":"إعادة كلمة المرور"}
            </button>}
          </div>
        </>}
        {!target&&msg&&<div className="notice">{msg}</div>}
      </section>
    </div>}
  </>;
}

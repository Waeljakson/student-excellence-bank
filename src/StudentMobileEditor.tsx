import {useState} from "react";
import {niceError,rpc} from "./client";
import "./student-class-editor.css";
import "./student-mobile-editor.css";

type StudentLite={id:string;name:string};

function normalizeMobile(value:string){
  let m=value.replace(/\D/g,"");
  if(m.startsWith("009665"))m="0"+m.slice(5);
  else if(m.startsWith("9665"))m="0"+m.slice(3);
  else if(m.length===9&&m.startsWith("5"))m="0"+m;
  return m;
}

export default function StudentMobileEditor({student}:{student:StudentLite}){
  const[open,setOpen]=useState(false);
  const[mobile,setMobile]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function show(){
    setOpen(true);setBusy(true);setMsg("");
    try{
      const data=await rpc<any>("api_student_mobile",{p_student_id:student.id});
      setMobile(String(data?.mobile||""));
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  async function save(){
    const m=normalizeMobile(mobile);
    if(!/^05\d{8}$/.test(m)){setMsg("اكتب رقم الجوال بصيغة صحيحة مثل 05xxxxxxxx.");return}
    setBusy(true);setMsg("");
    try{
      await rpc("api_set_student_mobile",{p_student_id:student.id,p_mobile:m});
      setMobile(m);setOpen(false);
      window.alert(`تم حفظ رقم جوال ${student.name} وربطه بحساب ولي الأمر.`);
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  return <>
    <button type="button" className="btn ghost student-mobile-edit-btn" onClick={show}>تعديل الجوال</button>
    {open&&<div className="student-class-backdrop" onClick={()=>!busy&&setOpen(false)}>
      <div className="student-class-card" onClick={e=>e.stopPropagation()}>
        <button className="student-class-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <h3>رقم جوال الطالب / ولي الأمر</h3>
        <p><b>{student.name}</b></p>
        <label>رقم الجوال
          <input inputMode="tel" value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="05xxxxxxxx" disabled={busy}/>
        </label>
        <small className="student-class-hint">هذا الرقم هو اسم دخول ولي الأمر. كلمة المرور الافتراضية: رقم الجوال متبوعًا بـ Aa.</small>
        {msg&&<div className="notice error">{msg}</div>}
        <div className="student-class-actions">
          <button className="btn ghost" type="button" onClick={()=>setOpen(false)} disabled={busy}>إلغاء</button>
          <button className="btn primary" type="button" onClick={save} disabled={busy||!mobile.trim()}>{busy?"جارٍ الحفظ...":"حفظ الجوال"}</button>
        </div>
      </div>
    </div>}
  </>;
}

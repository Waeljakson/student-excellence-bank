import {useState} from "react";
import {niceError,rpc} from "./client";
import "./student-class-editor.css";

type StudentLite={id:string;name:string};

export default function StudentMedalAwardButton({student}:{student:StudentLite}){
  const[open,setOpen]=useState(false);
  const[title,setTitle]=useState("متفوق");
  const[kind,setKind]=useState<"ACADEMIC"|"HONOR">("ACADEMIC");
  const[description,setDescription]=useState("");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function award(){
    if(!title.trim()){setMsg("اكتب اسم الميدالية أو التكريم.");return}
    setBusy(true);setMsg("");
    try{
      await rpc("api_admin_award_student_medal",{
        p_student_id:student.id,
        p_title_ar:title.trim(),
        p_description_ar:description.trim()||null,
        p_medal_kind:kind
      });
      setMsg("تم منح الميدالية للطالب. ستظهر في حسابه، ويظهر إعلان التهنئة لولي الأمر لمدة 3 أيام.");
      setTimeout(()=>{setOpen(false);setMsg("");setTitle("متفوق");setKind("ACADEMIC");setDescription("")},900);
    }catch(e){setMsg(niceError(e))}
    finally{setBusy(false)}
  }

  return <>
    <button type="button" className="btn ghost" onClick={()=>setOpen(true)}>منح ميدالية</button>
    {open&&<div className="student-class-backdrop" onClick={()=>!busy&&setOpen(false)}>
      <div className="student-class-card medal-award-card" onClick={e=>e.stopPropagation()}>
        <button className="student-class-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <h3>منح ميدالية</h3>
        <p><b>{student.name}</b></p>
        <label>نوع التكريم<select value={kind} onChange={e=>setKind(e.target.value as "ACADEMIC"|"HONOR")}><option value="ACADEMIC">تفوق دراسي</option><option value="HONOR">تكريم عام</option></select></label>
        <label>اسم الميدالية<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: متفوق الفصل الدراسي الأول"/></label>
        <label>وصف مختصر<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="سبب التكريم أو الإنجاز"/></label>
        <button type="button" className="btn primary" disabled={busy} onClick={()=>void award()}>{busy?"جارٍ الحفظ...":"اعتماد الميدالية"}</button>
        {msg&&<div className="notice compact-notice">{msg}</div>}
      </div>
    </div>}
  </>;
}

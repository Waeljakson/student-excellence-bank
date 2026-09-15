import { useState } from "react";
import { niceError, rpc } from "./client";
import "./student-class-editor.css";

type StudentLite={id:string;name:string;grade_name:string;class_name:string;class_id?:string};
type ClassOption={id:string;grade_id:string;grade_name:string;class_name:string};

let optionsCache:ClassOption[]|null=null;
let optionsLoading:Promise<ClassOption[]>|null=null;

async function loadOptions(){
  if(optionsCache)return optionsCache;
  if(!optionsLoading){
    optionsLoading=rpc<ClassOption[]>("api_student_class_options").then(rows=>{
      optionsCache=Array.isArray(rows)?rows:[];
      return optionsCache;
    }).finally(()=>{optionsLoading=null});
  }
  return optionsLoading;
}

export default function StudentClassEditor({student,onChanged}:{student:StudentLite;onChanged:()=>Promise<void>}){
  const[open,setOpen]=useState(false);
  const[options,setOptions]=useState<ClassOption[]>([]);
  const[selected,setSelected]=useState(student.class_id||"");
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function show(){
    setOpen(true);setBusy(true);setMsg("");setSelected(student.class_id||"");
    try{
      const rows=await loadOptions();
      setOptions(rows.filter(x=>x.grade_name===student.grade_name));
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  async function save(){
    if(!selected||selected===student.class_id){setOpen(false);return}
    setBusy(true);setMsg("");
    try{
      const result=await rpc<any>("api_update_student_class",{p_student_id:student.id,p_class_id:selected});
      await onChanged();
      setOpen(false);
      window.alert(`تم تعديل فصل ${student.name} من ${student.class_name} إلى ${result?.class_name||"الفصل الجديد"}.`);
    }catch(e){setMsg(niceError(e))}finally{setBusy(false)}
  }

  return <>
    <button type="button" className="btn ghost student-class-edit-btn" onClick={show}>تعديل الفصل</button>
    {open&&<div className="student-class-backdrop" onClick={()=>!busy&&setOpen(false)}>
      <div className="student-class-card" onClick={e=>e.stopPropagation()}>
        <button className="student-class-close" type="button" onClick={()=>setOpen(false)} disabled={busy}>×</button>
        <h3>تعديل فصل الطالب</h3>
        <p><b>{student.name}</b><br/>{student.grade_name} — الفصل الحالي: {student.class_name}</p>
        <label>الفصل الجديد
          <select value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy}>
            <option value="">اختر الفصل</option>
            {options.map(c=><option key={c.id} value={c.id}>{c.grade_name} — فصل {c.class_name}</option>)}
          </select>
        </label>
        <small className="student-class-hint">يسمح بالنقل بين فصول نفس الصف الدراسي فقط.</small>
        {msg&&<div className="notice error">{msg}</div>}
        <div className="student-class-actions">
          <button className="btn ghost" type="button" onClick={()=>setOpen(false)} disabled={busy}>إلغاء</button>
          <button className="btn primary" type="button" onClick={save} disabled={busy||!selected}>{busy?"جارٍ الحفظ...":"حفظ الفصل"}</button>
        </div>
      </div>
    </div>}
  </>;
}

import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./guardian-portal.css";
import "./periodic-evaluation.css";

type S={id:string;student_no:string;name:string;class_id:string;grade_name:string;class_name:string};
type Note={id:string;student_id:string;student_no?:string;student_name?:string;class_id:string;grade_name?:string;class_name?:string;teacher_user_id?:string;teacher_name?:string;subject_ar?:string;note_kind:"POSITIVE"|"NEGATIVE"|"GENERAL";category_ar?:string;note_text:string;note_date:string;created_at:string};
type Data={can_monitor?:boolean;students:S[];notes:Note[]};
type ClassGroup={id:string;label:string;students:S[]};

const kindLabel=(kind:string)=>kind==="POSITIVE"?"إيجابية":kind==="NEGATIVE"?"سلبية":"عامة";

export default function StudentFollowupNotebook(){
  const[data,setData]=useState<Data|null>(null);
  const[studentId,setStudentId]=useState("");
  const[classId,setClassId]=useState("");
  const[kind,setKind]=useState("NEGATIVE");
  const[category,setCategory]=useState("الواجبات");
  const[text,setText]=useState("");
  const[msg,setMsg]=useState("");
  const[busy,setBusy]=useState(false);
  const[q,setQ]=useState("");
  const[monitorKind,setMonitorKind]=useState("ALL");

  async function load(){try{setData(await rpc<Data>("api_teacher_followup_data"))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{void load()},[]);

  const students=data?.students||[];
  const notes=data?.notes||[];
  const canMonitor=!!data?.can_monitor;
  const classes=useMemo<ClassGroup[]>(()=>{
    const map=new Map<string,ClassGroup>();
    students.forEach(s=>{
      if(!map.has(s.class_id))map.set(s.class_id,{id:s.class_id,label:`${s.grade_name} / فصل ${s.class_name}`,students:[]});
      map.get(s.class_id)!.students.push(s);
    });
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label,"ar"));
  },[students]);

  useEffect(()=>{
    if(canMonitor&&classes.length&&!classes.some(c=>c.id===classId))setClassId(classes[0].id);
  },[canMonitor,classes,classId]);

  const classNotes=useMemo(()=>{
    const term=q.trim().toLowerCase();
    return notes.filter(n=>n.class_id===classId)
      .filter(n=>monitorKind==="ALL"||n.note_kind===monitorKind)
      .filter(n=>!term||`${n.student_name||""} ${n.student_no||""} ${n.teacher_name||""} ${n.subject_ar||""} ${n.category_ar||""} ${n.note_text||""}`.toLowerCase().includes(term));
  },[notes,classId,monitorKind,q]);

  const classNoteCount=(id:string)=>notes.filter(n=>n.class_id===id).length;
  const selectedClass=classes.find(c=>c.id===classId);
  const classPositive=notes.filter(n=>n.class_id===classId&&n.note_kind==="POSITIVE").length;
  const classNegative=notes.filter(n=>n.class_id===classId&&n.note_kind==="NEGATIVE").length;
  const classGeneral=notes.filter(n=>n.class_id===classId&&n.note_kind==="GENERAL").length;

  async function saveStudent(){if(!studentId||!text.trim())return;setBusy(true);setMsg("");try{await rpc("api_add_student_followup_note",{p_student_id:studentId,p_kind:kind,p_category_ar:category,p_note_text:text});setText("");setMsg("تم حفظ الملاحظة وإتاحتها لولي الأمر.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}
  async function saveClass(){if(!classId||!text.trim())return;setBusy(true);setMsg("");try{const r=await rpc<any>("api_add_class_followup_note",{p_class_id:classId,p_kind:kind,p_category_ar:category,p_note_text:text});setText("");setMsg(`تم إرسال الملاحظة إلى ${r.count||0} طالب في الفصل.`);await load()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}

  if(canMonitor)return <>
    <header className="topbar"><div><h1>دفتر متابعة الطلاب</h1><p>عرض إشرافي لملاحظات المعلمين على الطلاب، مرتبة حسب الفصول خلال آخر 90 يومًا.</p></div></header>
    <main className="content">
      <section className="panel">
        <div className="panel-title"><div><h3>ملاحظات المعلمين حسب الفصل</h3><p>اختر الفصل لمراجعة جميع الملاحظات المسجلة على طلابه مع اسم المعلم والمادة والتاريخ.</p></div><button className="mini-btn" type="button" onClick={()=>load()}>تحديث الآن</button></div>
        <div className="periodic-class-tabs">{classes.map(c=><button key={c.id} className={classId===c.id?"active":""} onClick={()=>setClassId(c.id)}><b>{c.label}</b><small>{classNoteCount(c.id)} ملاحظة</small></button>)}</div>
        {selectedClass&&<>
          <div className="teacher-progress-summary">
            <div><small>طلاب الفصل</small><b>{selectedClass.students.length}</b></div>
            <div className="done"><small>ملاحظات إيجابية</small><b>{classPositive}</b></div>
            <div className="not-started"><small>ملاحظات سلبية</small><b>{classNegative}</b></div>
            <div><small>ملاحظات عامة</small><b>{classGeneral}</b></div>
            <div className="remaining"><small>إجمالي الملاحظات</small><b>{classNoteCount(classId)}</b></div>
          </div>
          <div className="periodic-tools">
            <div><b>{selectedClass.label}</b><span>تظهر أحدث الملاحظات أولًا.</span></div>
            <div className="form-row">
              <select value={monitorKind} onChange={e=>setMonitorKind(e.target.value)}><option value="ALL">كل الأنواع</option><option value="POSITIVE">إيجابية</option><option value="NEGATIVE">سلبية</option><option value="GENERAL">عامة</option></select>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث باسم الطالب أو المعلم أو نص الملاحظة"/>
            </div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>المعلم / المادة</th><th>النوع</th><th>التصنيف</th><th>الملاحظة</th><th>التاريخ</th></tr></thead><tbody>
            {classNotes.map(n=><tr key={n.id}><td><b>{n.student_name||"—"}</b><br/><small>{n.student_no||""}</small></td><td><b>{n.teacher_name||"—"}</b><br/><small>{n.subject_ar||"—"}</small></td><td><span className={`teacher-status ${n.note_kind==="POSITIVE"?"completed":n.note_kind==="NEGATIVE"?"not-started":"in-progress"}`}>{kindLabel(n.note_kind)}</span></td><td>{n.category_ar||"—"}</td><td style={{whiteSpace:"pre-wrap",minWidth:260}}>{n.note_text||"—"}</td><td>{new Date(n.note_date||n.created_at).toLocaleDateString("ar-SA")}</td></tr>)}
            {!classNotes.length&&<tr><td colSpan={6} className="periodic-empty-row">لا توجد ملاحظات مطابقة في هذا الفصل حتى الآن.</td></tr>}
          </tbody></table></div>
        </>}
        {!classes.length&&<div className="notice">لا توجد فصول متاحة للعرض.</div>}
        {msg&&<div className="notice">{msg}</div>}
      </section>
    </main>
  </>;

  return <><header className="topbar"><div><h1>دفتر متابعة الواجبات</h1><p>ملاحظات فردية أو عامة للفصل تظهر لولي الأمر باسم المادة والمعلم والتاريخ.</p></div></header><main className="content"><section className="panel form-stack"><div className="referral-grid two"><label>نوع الملاحظة<select value={kind} onChange={e=>setKind(e.target.value)}><option value="POSITIVE">إيجابية</option><option value="NEGATIVE">سلبية</option><option value="GENERAL">عامة</option></select></label><label>التصنيف<select value={category} onChange={e=>setCategory(e.target.value)}><option>الواجبات</option><option>الأدوات</option><option>الانضباط</option><option>المشاركة</option><option>التركيز</option><option>السلوك داخل الصف</option><option>ملاحظة عامة</option></select></label></div><label>الملاحظة<textarea rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="مثال: مقصر في الواجب / مهمل في الأدوات / مشارك ومتميز..."/></label><div className="referral-grid two"><label>لطالب محدد<select value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">اختر الطالب</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade_name}/{s.class_name}</option>)}</select></label><label>أو للفصل كامل<select value={classId} onChange={e=>setClassId(e.target.value)}><option value="">اختر الفصل</option>{classes.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div><div className="form-row"><button className="btn primary" disabled={busy||!studentId||!text.trim()} onClick={saveStudent}>حفظ للطالب</button><button className="btn ghost" disabled={busy||!classId||!text.trim()} onClick={saveClass}>إرسال للفصل كامل</button></div>{msg&&<div className="notice">{msg}</div>}</section></main></>;
}

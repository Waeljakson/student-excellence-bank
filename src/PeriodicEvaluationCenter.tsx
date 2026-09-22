import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./guardian-portal.css";
import "./periodic-evaluation.css";

const ACADEMIC=["متفوق دراسيًا.","مستواه الدراسي ممتاز.","مستواه الدراسي جيد جدًا.","مستواه الدراسي جيد.","مستواه الدراسي مقبول.","يحتاج إلى مزيد من المتابعة.","يحتاج إلى دعم لتحسين مستواه.","مستواه في تحسن ملحوظ."];
const BEHAVIOR=["ملتزم ومنضبط.","متعاون ومحترم.","مشارك وإيجابي.","هادئ ومنتبه.","هادئ وغير منتبه.","ملتزم بتعليمات المعلم.","سلوكه جيد داخل الفصل.","يحتاج إلى مزيد من التركيز.","يحتاج إلى تحسين الالتزام بالتعليمات.","يحتاج إلى ضبط الحديث أثناء الحصة.","يحتاج إلى متابعة سلوكية مستمرة."];

type S={id:string;name:string;student_no:string;class_id:string;grade_name:string;class_name:string};
type Draft={academic:string;behavior:string;notes:string};
type ClassGroup={id:string;label:string;grade_name:string;class_name:string;students:S[]};
type TeacherProgress={teacher_id:string;teacher_name:string;subject_ar:string;class_count:number;expected_count:number;completed_count:number;remaining_count:number;progress_percent:number;status:"NOT_STARTED"|"IN_PROGRESS"|"COMPLETED";last_evaluation_at?:string|null};

export default function PeriodicEvaluationCenter(){
  const[data,setData]=useState<any>(null);
  const[msg,setMsg]=useState("");
  const[busy,setBusy]=useState("");
  const[title,setTitle]=useState("التقييم الدوري");
  const[start,setStart]=useState("");
  const[due,setDue]=useState("");
  const[classId,setClassId]=useState("");
  const[onlyPending,setOnlyPending]=useState(false);
  const[showCompletedTeachers,setShowCompletedTeachers]=useState(false);
  const[drafts,setDrafts]=useState<Record<string,Draft>>({});

  async function load(){try{setData(await rpc<any>("api_periodic_evaluation_data"))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{void load()},[]);

  const cycles=data?.cycles||[];
  const active=cycles.find((x:any)=>x.status==="ACTIVE");
  const students:S[]=data?.students||[];
  const evaluations:any[]=data?.evaluations||[];
  const teacherProgress:TeacherProgress[]=data?.teacher_progress||[];
  const visibleTeacherProgress=showCompletedTeachers?teacherProgress:teacherProgress.filter(t=>t.status!=="COMPLETED");
  const teachersCompleted=teacherProgress.filter(t=>t.status==="COMPLETED").length;
  const teachersNotStarted=teacherProgress.filter(t=>t.status==="NOT_STARTED").length;
  const teachersInProgress=teacherProgress.filter(t=>t.status==="IN_PROGRESS").length;
  const teacherRemainingTotal=teacherProgress.reduce((sum,t)=>sum+Number(t.remaining_count||0),0);

  const existing=useMemo(()=>new Map(evaluations.filter((x:any)=>x.cycle_id===active?.id).map((x:any)=>[x.student_id,x])),[evaluations,active?.id]);

  const classes=useMemo<ClassGroup[]>(()=>{
    const map=new Map<string,ClassGroup>();
    students.forEach(s=>{
      if(!map.has(s.class_id))map.set(s.class_id,{id:s.class_id,label:`${s.grade_name} — فصل ${s.class_name}`,grade_name:s.grade_name,class_name:s.class_name,students:[]});
      map.get(s.class_id)!.students.push(s);
    });
    return Array.from(map.values()).map(g=>({...g,students:[...g.students].sort((a,b)=>a.name.localeCompare(b.name,"ar"))})).sort((a,b)=>a.label.localeCompare(b.label,"ar"));
  },[students]);

  useEffect(()=>{
    if(classes.length&&!classes.some(c=>c.id===classId))setClassId(classes[0].id);
  },[classes,classId]);

  useEffect(()=>{
    if(!active)return;
    setDrafts(prev=>{
      const next={...prev};
      students.forEach(s=>{
        const old:any=existing.get(s.id);
        next[s.id]={
          academic:old?.academic_rating||next[s.id]?.academic||ACADEMIC[1],
          behavior:old?.behavior_rating||next[s.id]?.behavior||BEHAVIOR[0],
          notes:old?.notes??next[s.id]?.notes??""
        };
      });
      return next;
    });
  },[active?.id,evaluations.length,students.length]);

  const currentClass=classes.find(c=>c.id===classId)||classes[0];
  const currentStudents=(currentClass?.students||[]).filter(s=>!onlyPending||!existing.has(s.id));
  const totalDone=students.filter(s=>existing.has(s.id)).length;
  const totalPending=Math.max(0,students.length-totalDone);

  function classStats(c:ClassGroup){
    const done=c.students.filter(s=>existing.has(s.id)).length;
    return{done,pending:c.students.length-done,total:c.students.length};
  }
  function patchDraft(id:string,patch:Partial<Draft>){setDrafts(x=>({...x,[id]:{academic:x[id]?.academic||ACADEMIC[1],behavior:x[id]?.behavior||BEHAVIOR[0],notes:x[id]?.notes||"",...patch}}))}

  async function createCycle(){
    if(!start||!due)return;
    setBusy("create");setMsg("");
    try{await rpc("api_create_periodic_cycle",{p_title_ar:title,p_starts_at:new Date(start).toISOString(),p_due_at:new Date(due).toISOString()});setMsg("تم إنشاء دورة التقييم في وضع المسودة.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  async function action(id:string,a:string){
    setBusy(a);setMsg("");
    try{await rpc("api_set_periodic_cycle_state",{p_cycle_id:id,p_action:a});setMsg(a==="ACTIVATE"?"تم إطلاق الدورة وإشعار المعلمين.":a==="PUBLISH"?"تم نشر النتائج في حسابات أولياء الأمور.":"تم إغلاق الدورة.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  async function saveStudent(student:S){
    if(!active)return;
    const d=drafts[student.id]||{academic:ACADEMIC[1],behavior:BEHAVIOR[0],notes:""};
    setBusy(`save:${student.id}`);setMsg("");
    try{
      await rpc("api_submit_periodic_evaluation",{p_cycle_id:active.id,p_student_id:student.id,p_academic_rating:d.academic,p_behavior_rating:d.behavior,p_notes:d.notes||null});
      setMsg(`تم حفظ تقييم الطالب ${student.name}.`);
      await load();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }

  return <><header className="topbar"><div><h1>التقييمات الدورية</h1><p>دورة تقييم تحصيلي وسلوكي للطلاب، ثم نشر النتائج لأولياء الأمور.</p></div></header><main className="content">
    {data?.excluded_from_periodic&&<section className="panel empty"><b>التربية البدنية غير مشمولة في التقييم الدوري.</b><p>لا يُطلب من معلم التربية البدنية إدخال تقييمات دورية للطلاب.</p></section>}

    {data?.can_manage&&<section className="panel form-stack"><h3>إدارة دورة التقييم</h3><div className="referral-grid two"><label>اسم الدورة<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>بداية الدورة<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>الموعد النهائي<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><button className="btn primary" disabled={busy==="create"} onClick={createCycle}>إنشاء دورة</button></div>{cycles.map((c:any)=><div className="cycle-admin-row" key={c.id}><div><b>{c.title_ar}</b><small>{c.status} · حتى {new Date(c.due_at).toLocaleString("ar-SA")}</small></div><div>{c.status==="DRAFT"&&<button className="mini-btn" onClick={()=>action(c.id,"ACTIVATE")}>إطلاق الدورة</button>}{c.status==="ACTIVE"&&<button className="mini-btn" onClick={()=>action(c.id,"CLOSE")}>إغلاق التقييم</button>}{c.status==="CLOSED"&&<button className="mini-btn" onClick={()=>action(c.id,"PUBLISH")}>نشر لولي الأمر</button>}</div></div>)}</section>}

    {data?.can_manage&&active&&<section className="panel teacher-progress-panel">
      <div className="panel-title"><div><h3>متابعة إنجاز المعلمين</h3><p>متابعة مباشرة لعدد الطلاب الذين قيّمهم كل معلم والمتبقي عليه في الدورة الحالية.</p></div><button className="mini-btn" type="button" onClick={()=>load()}>تحديث الآن</button></div>
      <div className="teacher-progress-summary">
        <div><small>إجمالي المعلمين</small><b>{teacherProgress.length}</b></div>
        <div className="done"><small>أكملوا التقييم</small><b>{teachersCompleted}</b></div>
        <div className="progress"><small>تحت التنفيذ</small><b>{teachersInProgress}</b></div>
        <div className="not-started"><small>لم يبدأوا</small><b>{teachersNotStarted}</b></div>
        <div className="remaining"><small>إجمالي التقييمات المتبقية</small><b>{teacherRemainingTotal}</b></div>
      </div>
      <div className="periodic-tools"><div><b>المعلمون غير المكتملين: {teacherProgress.length-teachersCompleted}</b><span>القائمة مرتبة بحيث يظهر غير المكتمل أولًا والأكثر طلابًا متبقيًا في الأعلى.</span></div><label className="periodic-pending-toggle"><input type="checkbox" checked={showCompletedTeachers} onChange={e=>setShowCompletedTeachers(e.target.checked)}/> إظهار المعلمين المكتملين أيضًا</label></div>
      <div className="table-wrap teacher-progress-table-wrap"><table className="teacher-progress-table"><thead><tr><th>المعلم</th><th>المادة</th><th>الفصول</th><th>المطلوب</th><th>تم تقييمه</th><th>المتبقي</th><th>الإنجاز</th><th>الحالة</th><th>آخر تقييم</th></tr></thead><tbody>
        {visibleTeacherProgress.map(t=><tr key={t.teacher_id} className={`teacher-progress-row ${t.status.toLowerCase().replace("_","-")}`}><td><b>{t.teacher_name}</b></td><td>{t.subject_ar||"—"}</td><td>{t.class_count}</td><td>{t.expected_count}</td><td>{t.completed_count}</td><td><strong className={t.remaining_count>0?"remaining-count":"done-count"}>{t.remaining_count}</strong></td><td><div className="progress-cell"><span><i style={{width:`${Math.min(100,Math.max(0,Number(t.progress_percent||0)))}%`}}/></span><b>{Number(t.progress_percent||0)}%</b></div></td><td><span className={`teacher-status ${t.status.toLowerCase().replace("_","-")}`}>{t.status==="COMPLETED"?"✓ مكتمل":t.status==="NOT_STARTED"?"لم يبدأ":"تحت التنفيذ"}</span></td><td>{t.last_evaluation_at?new Date(t.last_evaluation_at).toLocaleString("ar-SA"):"—"}</td></tr>)}
        {!visibleTeacherProgress.length&&<tr><td colSpan={9} className="periodic-empty-row">جميع المعلمين أكملوا التقييم ✓</td></tr>}
      </tbody></table></div>
    </section>}

    {active&&students.length>0?<section className="panel periodic-board">
      <div className="panel-title periodic-head"><div><h3>{active.title_ar}</h3><p>آخر موعد: {new Date(active.due_at).toLocaleString("ar-SA")}</p></div><div className="periodic-overall"><span className="done">✓ تم {totalDone}</span><span className={totalPending?"pending":"done"}>متبقي {totalPending}</span><b>{totalDone}/{students.length}</b></div></div>

      {classes.length>0&&<>
        <div className="periodic-class-tabs">{classes.map(c=>{const st=classStats(c);return <button key={c.id} className={classId===c.id?"active":""} onClick={()=>setClassId(c.id)}><b>{c.label}</b><small>{st.done}/{st.total} مكتمل{st.pending>0?` · ${st.pending} باقي`:" · مكتمل ✓"}</small></button>})}</div>

        <div className="periodic-tools"><div>{currentClass&&<><b>{currentClass.label}</b><span>{classStats(currentClass).done} تم تقييمهم · {classStats(currentClass).pending} لم يُقيَّموا</span></>}</div><label className="periodic-pending-toggle"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)}/> إظهار غير المقيمين فقط</label></div>

        <div className="table-wrap periodic-table-wrap"><table className="periodic-table"><thead><tr><th>الطالب</th><th>المستوى التحصيلي</th><th>المستوى السلوكي</th><th>ملاحظة إضافية</th><th>الحالة</th><th></th></tr></thead><tbody>
          {currentStudents.map(s=>{const d=drafts[s.id]||{academic:ACADEMIC[1],behavior:BEHAVIOR[0],notes:""};const done=existing.has(s.id);return <tr key={s.id} className={done?"evaluated":"not-evaluated"}><td className="student-cell"><b>{s.name}</b><small>{s.student_no}</small></td><td><select value={d.academic} onChange={e=>patchDraft(s.id,{academic:e.target.value})}>{ACADEMIC.map(x=><option key={x}>{x}</option>)}</select></td><td><select value={d.behavior} onChange={e=>patchDraft(s.id,{behavior:e.target.value})}>{BEHAVIOR.map(x=><option key={x}>{x}</option>)}</select></td><td><input value={d.notes} onChange={e=>patchDraft(s.id,{notes:e.target.value})} placeholder="اختياري"/></td><td><span className={`evaluation-status ${done?"done":"pending"}`}>{done?"✓ تم التقييم":"لم يُقيَّم"}</span></td><td><button className={`mini-btn ${done?"":"primary"}`} disabled={busy===`save:${s.id}`} onClick={()=>saveStudent(s)}>{busy===`save:${s.id}`?"جارٍ الحفظ...":done?"تحديث":"حفظ"}</button></td></tr>})}
          {!currentStudents.length&&<tr><td colSpan={6} className="periodic-empty-row">{onlyPending?"تم تقييم جميع طلاب هذا الفصل ✓":"لا يوجد طلاب في هذا الفصل."}</td></tr>}
        </tbody></table></div>
      </>}
    </section>:!data?.excluded_from_periodic&&!active&&!data?.can_manage&&<section className="panel empty">لا توجد دورة تقييم دورية مفعلة حاليًا.</section>}
    {msg&&<div className="notice">{msg}</div>}
  </main></>;
}
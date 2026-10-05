import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./student-exit-tracker.css";

type StudentRow={id:string;student_no:string;name:string;class_id:string;grade_name:string;class_name:string};
type ExitEvent={id:string;student_id:string;class_id:string;lesson_no:number;subject_ar?:string;exited_at:string;returned_at?:string|null;duration_minutes:number;teacher_name?:string};
type AbsenceEvent={id:string;student_id:string;class_id:string;lesson_no:number;subject_ar?:string;teacher_name?:string;marked_at:string};
type FollowupNote={id:string;student_id:string;category_ar?:string;note_text?:string;created_at?:string;teacher_name?:string};
type ExitData={today:string;current_lesson_no?:number|null;teacher_subject_ar?:string;students:StudentRow[];events:ExitEvent[];absences?:AbsenceEvent[]};
type FollowupData={students:StudentRow[];notes:FollowupNote[]};
type ClassGroup={id:string;label:string;students:StudentRow[]};

function errorText(e:unknown){
  const t=niceError(e);
  if(t.includes("NO_ACTIVE_LESSON"))return "الآن خارج وقت الحصص الدراسية المحدد في الجدول الزمني.";
  if(t.includes("TEACHER_STUDENT_ACCESS_DENIED"))return "هذا الطالب خارج نطاق فصولك.";
  if(t.includes("TEACHER_REQUIRED"))return "هذه الخاصية متاحة للمعلم فقط.";
  return t;
}
function clock(value?:string|null){
  if(!value)return "—";
  return new Date(value).toLocaleTimeString("ar-SA",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit"});
}
function minutesText(value:number){
  const n=Number(value||0);
  if(n>0&&n<1)return "أقل من دقيقة";
  return n.toLocaleString("ar-SA",{maximumFractionDigits:1})+" دقيقة";
}
type LessonInfo={no:number;label:string;start:string;end:string}|null;
function currentLessonInfo():LessonInfo{
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const h=Number(parts.find(x=>x.type==="hour")?.value||0);
  const m=Number(parts.find(x=>x.type==="minute")?.value||0);
  const value=h*60+m;
  const rows=[
    {no:1,label:"الحصة الأولى",start:"7:00",end:"7:45",from:420,to:465},
    {no:2,label:"الحصة الثانية",start:"7:45",end:"8:30",from:465,to:510},
    {no:3,label:"الحصة الثالثة",start:"8:30",end:"9:15",from:510,to:555},
    {no:4,label:"الحصة الرابعة",start:"9:40",end:"10:20",from:580,to:620},
    {no:5,label:"الحصة الخامسة",start:"10:20",end:"11:00",from:620,to:660},
    {no:6,label:"الحصة السادسة",start:"11:00",end:"11:40",from:660,to:700},
  ];
  const row=rows.find(x=>value>=x.from&&value<x.to);
  return row?{no:row.no,label:row.label,start:row.start,end:row.end}:null;
}
function riyadhStamp(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const get=(t:string)=>parts.find(x=>x.type===t)?.value||"00";
  return {date:get("year")+"-"+get("month")+"-"+get("day"),time:get("hour")+":"+get("minute")+":"+get("second")};
}
function noteStamp(text:string){
  const m=text.match(/وقت (?:الخروج|العودة):\s*(\d{2}:\d{2}:\d{2})\s*\((\d{4}-\d{2}-\d{2})\)/);
  return m?new Date(m[2]+"T"+m[1]+"+03:00").toISOString():"";
}
function noteLesson(text:string){
  const m=text.match(/الحصة رقم\s*(\d+)/);
  return m?Number(m[1]):1;
}
function fallbackEvents(notes:FollowupNote[],students:StudentRow[]){
  const today=riyadhStamp().date;
  const rows=(notes||[]).filter(n=>String(n.category_ar||"").startsWith("استئذان:"))
    .map(n=>{const text=String(n.note_text||"");const day=text.match(/\\((\\d{4}-\\d{2}-\\d{2})\\)/)?.[1]||"";return {n,at:noteStamp(text),day}})
    .filter(x=>x.at&&x.day===today)
    .sort((a,b)=>a.at.localeCompare(b.at));
  const open=new Map<string,ExitEvent[]>();
  const out:ExitEvent[]=[];
  const studentMap=new Map(students.map(s=>[s.id,s]));
  for(const row of rows){
    const n=row.n;
    const cat=String(n.category_ar||"");
    if(cat==="استئذان: خروج"){
      const s=studentMap.get(n.student_id);
      if(!s)continue;
      const e:ExitEvent={id:n.id,student_id:n.student_id,class_id:s.class_id,lesson_no:noteLesson(String(n.note_text||"")),exited_at:row.at,returned_at:null,duration_minutes:0,teacher_name:n.teacher_name};
      out.push(e);
      const list=open.get(n.student_id)||[];list.push(e);open.set(n.student_id,list);
    }else if(cat==="استئذان: عودة"){
      const list=open.get(n.student_id)||[];
      const e=[...list].reverse().find(x=>!x.returned_at);
      if(e){
        e.returned_at=row.at;
        e.duration_minutes=Math.max(0,(new Date(row.at).getTime()-new Date(e.exited_at).getTime())/60000);
      }
    }
  }
  return out.sort((a,b)=>b.exited_at.localeCompare(a.exited_at));
}

export default function TeacherStudentExitTracker(){
  const[data,setData]=useState<ExitData|null>(null);
  const[fallback,setFallback]=useState(false);
  const[classId,setClassId]=useState("");
  const[q,setQ]=useState("");
  const[busy,setBusy]=useState("");
  const[msg,setMsg]=useState("");
  const[tick,setTick]=useState(0);

  async function load(){
    setMsg("");
    try{
      const next=await rpc<ExitData>("api_teacher_student_exit_data");
      setFallback(false);setData(next);return;
    }catch{}
    try{
      const f=await rpc<FollowupData>("api_teacher_followup_data");
      const students=Array.isArray(f?.students)?f.students:[];
      const notes=Array.isArray(f?.notes)?f.notes:[];
      setFallback(true);
      setData({today:riyadhStamp().date,students,events:fallbackEvents(notes,students),absences:[]});
    }catch(e){setMsg(errorText(e))}
  }
  useEffect(()=>{void load()},[]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setTick(x=>x+1),30000);
    return()=>window.clearInterval(timer);
  },[]);

  const students=data?.students||[];
  const events=data?.events||[];
  const absences=data?.absences||[];
  const currentLesson=useMemo(()=>currentLessonInfo(),[tick]);
  const teacherSubject=data?.teacher_subject_ar||"الحصة الدراسية";
  const classes=useMemo<ClassGroup[]>(()=>{
    const map=new Map<string,ClassGroup>();
    students.forEach(s=>{
      if(!map.has(s.class_id))map.set(s.class_id,{id:s.class_id,label:s.grade_name+" / فصل "+s.class_name,students:[]});
      map.get(s.class_id)!.students.push(s);
    });
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label,"ar"));
  },[students]);

  useEffect(()=>{
    if(classes.length&&!classes.some(c=>c.id===classId))setClassId(classes[0].id);
  },[classes,classId]);

  const visible=useMemo(()=>{
    const term=q.trim().toLowerCase();
    return students.filter(s=>!classId||s.class_id===classId)
      .filter(s=>!term||(s.name+" "+s.student_no).toLowerCase().includes(term));
  },[students,classId,q]);

  function studentEvents(studentId:string){
    return events.filter(e=>e.student_id===studentId).sort((a,b)=>b.exited_at.localeCompare(a.exited_at));
  }
  function openEvent(studentId:string){
    return studentEvents(studentId).find(e=>!e.returned_at);
  }
  function totalMinutes(studentId:string){
    return studentEvents(studentId).reduce((sum,e)=>{
      if(e.returned_at)return sum+Number(e.duration_minutes||0);
      return sum+Math.max(0,(Date.now()-new Date(e.exited_at).getTime())/60000);
    },0);
  }

  async function act(student:StudentRow,action:"EXIT"|"RETURN"){
    if(busy)return;
    if(action==="EXIT"&&!currentLesson){setMsg("الآن خارج وقت الحصص الدراسية المحدد في الجدول الزمني.");return}
    setBusy(student.id);setMsg("");
    try{
      if(fallback){
        const stamp=riyadhStamp();
        const current=openEvent(student.id);
        const lesson=action==="RETURN"?(current?.lesson_no||currentLesson?.no||1):(currentLesson?.no||1);
        const category=action==="EXIT"?"استئذان: خروج":"استئذان: عودة";
        const note=action==="EXIT"
          ?"استأذن الطالب من "+teacherSubject+" أثناء الحصة رقم "+lesson+". وقت الخروج: "+stamp.time+" ("+stamp.date+")."
          :"عاد الطالب إلى الفصل. وقت العودة: "+stamp.time+" ("+stamp.date+").";
        await rpc("api_add_student_followup_note",{p_student_id:student.id,p_kind:"GENERAL",p_category_ar:category,p_note_text:note});
      }else{
        await rpc("api_teacher_student_exit_action",{p_student_id:student.id,p_action:action,p_lesson_no:currentLesson?.no||null});
      }
      setMsg(action==="EXIT"?"تم تسجيل استئذان "+student.name+" من "+teacherSubject+".":"تم تسجيل عودة "+student.name+" وحساب مدة الخروج.");
      await load();
    }catch(e){setMsg(errorText(e))}finally{setBusy("")}
  }

  async function markAbsent(student:StudentRow){
    if(busy)return;
    if(!currentLesson){setMsg("لا يمكن تسجيل عدم حضور حصة خارج وقت الحصص الدراسية.");return}
    const existing=absences.find(a=>a.student_id===student.id&&a.lesson_no===currentLesson.no);
    setBusy(student.id+"-absence");setMsg("");
    try{
      if(fallback){
        const stamp=riyadhStamp();
        const category="الحضور: لم يحضر الحصة";
        const note="لم يحضر الطالب "+teacherSubject+" في الحصة رقم "+currentLesson.no+". وقت التسجيل: "+stamp.time+" ("+stamp.date+").";
        if(existing){setMsg("تم تسجيل عدم حضور هذا الطالب للحصة بالفعل.");return}
        await rpc("api_add_student_followup_note",{p_student_id:student.id,p_kind:"GENERAL",p_category_ar:category,p_note_text:note});
      }else{
        await rpc("api_teacher_student_absence_action",{p_student_id:student.id,p_action:existing?"UNMARK":"MARK"});
      }
      setMsg(existing?"تم إلغاء تسجيل عدم حضور "+student.name+".":"تم تسجيل أن "+student.name+" لم يحضر "+teacherSubject+".");
      await load();
    }catch(e){setMsg(errorText(e))}finally{setBusy("")}
  }

  return <>
    <header className="topbar"><div><h1>استئذان الطلاب من الحصة</h1><p>تسجيل خروج الطالب وعودته وحساب مدة بقائه خارج الفصل بالدقائق.</p></div></header>
    <main className="content">
      <section className="panel exit-control-panel">
        <div className="panel-title">
          <div><h3>الحصة الحالية تلقائيًا</h3><p>يحدد النظام الحصة حسب توقيت المدرسة، ولا يحتاج المعلم لاختيار رقم الحصة.</p></div>
          <button className="mini-btn" type="button" onClick={()=>void load()}>تحديث الآن</button>
        </div>
        <div className={"auto-lesson-banner "+(currentLesson?"active":"inactive")}>
          {currentLesson
            ?<><div><span>الآن</span><strong>{currentLesson.label}</strong><small>{currentLesson.start} — {currentLesson.end}</small></div><div><span>المادة</span><strong>{teacherSubject}</strong><small>تظهر لولي الأمر بهذا الاسم</small></div></>
            :<><div><span>الحالة</span><strong>خارج وقت الحصص</strong><small>التسجيل يتفعل تلقائيًا مع بداية الحصة</small></div></>}
        </div>
        <div className="exit-toolbar">
          <label>بحث عن طالب
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="الاسم أو رقم الطالب"/>
          </label>
        </div>
        <div className="exit-class-tabs">
          {classes.map(c=><button key={c.id} className={classId===c.id?"active":""} onClick={()=>setClassId(c.id)}><b>{c.label}</b><small>{c.students.length} طالب</small></button>)}
        </div>
        {!classes.length&&<div className="empty">لا توجد فصول مرتبطة بحساب المعلم.</div>}
        <div className="exit-student-list">
          {visible.map(s=>{
            const open=openEvent(s.id);
            const history=studentEvents(s.id);
            const latest=history[0];
            const total=totalMinutes(s.id);
            const liveMinutes=open?Math.max(0,(Date.now()-new Date(open.exited_at).getTime())/60000):0;
            return <article key={s.id} className={"exit-student-card "+(open?"is-out":"is-in")}>
              <div className="exit-student-main">
                <div className="exit-avatar">{s.name.trim().charAt(0)}</div>
                <div><b>{s.name}</b><small>{s.student_no} · {s.grade_name} / {s.class_name}</small></div>
              </div>
              <div className="exit-status">
                {open?<><strong>خارج الفصل الآن</strong><span>منذ {minutesText(liveMinutes)} · الحصة {open.lesson_no}</span></>:latest?<><strong>داخل الفصل</strong><span>آخر خروج {minutesText(Number(latest.duration_minutes||0))} · عاد {clock(latest.returned_at)}</span></>:<><strong>داخل الفصل</strong><span>لم يسجل خروج اليوم</span></>}
                {history.length>0&&<small>إجمالي اليوم: {minutesText(total)} · {history.length} {history.length===1?"مرة":"مرات"}</small>}
              </div>
              <div className="exit-actions">
                <button type="button" className={open?"return-btn":"exit-btn"} disabled={busy===s.id||(!open&&!currentLesson)} onClick={()=>void act(s,open?"RETURN":"EXIT")}>
                  {busy===s.id?"جارٍ التسجيل...":open?"عاد":"استأذن"}
                </button>
                {(()=>{
                  const absent=currentLesson?absences.some(a=>a.student_id===s.id&&a.lesson_no===currentLesson.no):false;
                  const absenceTitle=currentLesson?"تسجيل عدم حضور "+teacherSubject+" — "+currentLesson.label:"يتفعل الزر تلقائيًا أثناء وقت الحصة";
                  return <button
                    type="button"
                    className={absent?"absence-btn marked":"absence-btn"}
                    disabled={!currentLesson||busy===s.id+"-absence"}
                    title={absenceTitle}
                    onClick={()=>void markAbsent(s)}
                  >
                    {busy===s.id+"-absence"?"جارٍ التسجيل...":absent?"إلغاء عدم الحضور":"لم يحضر الحصة"}
                  </button>;
                })()}
              </div>
            </article>;
          })}
          {classes.length&&!visible.length&&<div className="empty">لا يوجد طلاب مطابقون للبحث في هذا الفصل.</div>}
        </div>
        {msg&&<div className="notice">{msg}</div>}
      </section>
    </main>
  </>;
}

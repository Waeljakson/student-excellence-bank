import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./student-exit-tracker.css";

type StudentRow={id:string;student_no:string;name:string;class_id:string;grade_name:string;class_name:string};
type ExitEvent={id:string;student_id:string;class_id:string;lesson_no:number;exited_at:string;returned_at?:string|null;duration_minutes:number;teacher_name?:string};
type FollowupNote={id:string;student_id:string;category_ar?:string;note_text?:string;created_at?:string;teacher_name?:string};
type ExitData={today:string;students:StudentRow[];events:ExitEvent[]};
type FollowupData={students:StudentRow[];notes:FollowupNote[]};
type ClassGroup={id:string;label:string;students:StudentRow[]};

function errorText(e:unknown){
  const t=niceError(e);
  if(t.includes("LESSON_NUMBER_REQUIRED"))return "اختر رقم الحصة أولًا.";
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
    .map(n=>({n,at:noteStamp(String(n.note_text||""))}))
    .filter(x=>x.at&&x.at.slice(0,10)===today)
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
  const[lessonNo,setLessonNo]=useState<number>(()=>Number(sessionStorage.getItem("mishkat-current-lesson")||"1"));
  const[q,setQ]=useState("");
  const[busy,setBusy]=useState("");
  const[msg,setMsg]=useState("");
  const[,setTick]=useState(0);

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
      setData({today:riyadhStamp().date,students,events:fallbackEvents(notes,students)});
    }catch(e){setMsg(errorText(e))}
  }
  useEffect(()=>{void load()},[]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setTick(x=>x+1),30000);
    return()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{sessionStorage.setItem("mishkat-current-lesson",String(lessonNo))},[lessonNo]);

  const students=data?.students||[];
  const events=data?.events||[];
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
    setBusy(student.id);setMsg("");
    try{
      if(fallback){
        const stamp=riyadhStamp();
        const current=openEvent(student.id);
        const lesson=action==="RETURN"?(current?.lesson_no||lessonNo):lessonNo;
        const category=action==="EXIT"?"استئذان: خروج":"استئذان: عودة";
        const note=action==="EXIT"
          ?"استأذن الطالب من الحصة رقم "+lesson+". وقت الخروج: "+stamp.time+" ("+stamp.date+")."
          :"عاد الطالب إلى الفصل في الحصة رقم "+lesson+". وقت العودة: "+stamp.time+" ("+stamp.date+").";
        await rpc("api_add_student_followup_note",{p_student_id:student.id,p_kind:"GENERAL",p_category_ar:category,p_note_text:note});
      }else{
        await rpc("api_teacher_student_exit_action",{p_student_id:student.id,p_action:action,p_lesson_no:lessonNo});
      }
      setMsg(action==="EXIT"?"تم تسجيل استئذان "+student.name+".":"تم تسجيل عودة "+student.name+" وحساب مدة الخروج.");
      await load();
    }catch(e){setMsg(errorText(e))}finally{setBusy("")}
  }

  return <>
    <header className="topbar"><div><h1>استئذان الطلاب من الحصة</h1><p>تسجيل خروج الطالب وعودته وحساب مدة بقائه خارج الفصل بالدقائق.</p></div></header>
    <main className="content">
      <section className="panel exit-control-panel">
        <div className="panel-title">
          <div><h3>الحصة الحالية</h3><p>اختر رقم الحصة ثم استخدم زر «استأذن» عند خروج الطالب و«عاد» فور رجوعه.</p></div>
          <button className="mini-btn" type="button" onClick={()=>void load()}>تحديث الآن</button>
        </div>
        <div className="exit-toolbar">
          <label>رقم الحصة
            <select value={lessonNo} onChange={e=>setLessonNo(Number(e.target.value))}>
              {Array.from({length:10},(_,i)=>i+1).map(n=><option key={n} value={n}>الحصة {n}</option>)}
            </select>
          </label>
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
              <button type="button" className={open?"return-btn":"exit-btn"} disabled={busy===s.id} onClick={()=>void act(s,open?"RETURN":"EXIT")}>
                {busy===s.id?"جارٍ التسجيل...":open?"عاد":"استأذن"}
              </button>
            </article>;
          })}
          {classes.length&&!visible.length&&<div className="empty">لا يوجد طلاب مطابقون للبحث في هذا الفصل.</div>}
        </div>
        {msg&&<div className="notice">{msg}</div>}
      </section>
    </main>
  </>;
}

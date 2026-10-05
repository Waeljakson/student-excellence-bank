import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./student-exit-analytics.css";

type OutStudent={
  student_id:string;student_name:string;student_no:string;grade_name?:string;class_name?:string;
  lesson_no:number;teacher_name?:string;exited_at:string;current_minutes:number;
};
type TopStudent={
  student_id:string;student_name:string;student_no:string;grade_name?:string;class_name?:string;
  exit_count:number;total_minutes:number;avg_minutes:number;
};
type ClassStat={
  class_id:string;grade_name?:string;class_name?:string;student_count:number;unique_students:number;
  exit_count:number;exit_rate_pct:number;total_minutes:number;avg_minutes:number;
};
type Daily={day:string;exit_count:number;unique_students:number;total_minutes:number};
type Lesson={lesson_no:number;exit_count:number;unique_students:number;avg_minutes:number};
type Analytics={
  period_days:number;from_date:string;to_date:string;total_students:number;exit_events:number;
  unique_students:number;student_exit_rate_pct:number;avg_exits_per_day:number;
  avg_exits_per_exiting_student:number;total_minutes:number;avg_minutes_per_exit:number;
  currently_out:number;currently_out_students:OutStudent[];top_students:TopStudent[];
  classes:ClassStat[];daily:Daily[];lessons:Lesson[];
};

const n=(v:any)=>Number(v||0);
const mins=(v:any)=>n(v).toLocaleString("ar-SA",{maximumFractionDigits:1})+" د";
const pct=(v:any)=>n(v).toLocaleString("ar-SA",{maximumFractionDigits:1})+"%";
const date=(v:string)=>new Date(v+"T12:00:00").toLocaleDateString("ar-SA",{day:"numeric",month:"short"});
const time=(v:string)=>new Date(v).toLocaleTimeString("ar-SA",{hour:"numeric",minute:"2-digit"});

export default function StudentExitAnalytics(){
  const[days,setDays]=useState(7);
  const[data,setData]=useState<Analytics|null>(null);
  const[busy,setBusy]=useState(false);
  const[msg,setMsg]=useState("");

  async function load(){
    setBusy(true);setMsg("");
    try{
      setData(await rpc<Analytics>("api_admin_student_exit_analytics",{p_days:days}));
    }catch(e){setMsg(niceError(e))}
    finally{setBusy(false)}
  }

  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(t)},[days]);

  const maxDaily=useMemo(()=>Math.max(1,...(data?.daily||[]).map(x=>n(x.exit_count))),[data]);
  const maxLesson=useMemo(()=>Math.max(1,...(data?.lessons||[]).map(x=>n(x.exit_count))),[data]);

  return <>
    <header className="topbar">
      <div><h1>معدلات خروج الطلاب من الفصل</h1><p>متابعة لحظية وتحليل معدلات الاستئذان حسب الطلاب والفصول والحصص.</p></div>
      <div className="exit-analytics-head-actions no-print">
        <button className="mini-btn" onClick={()=>window.print()}>طباعة التقرير</button>
        <button className="mini-btn" onClick={()=>void load()} disabled={busy}>{busy?"جارٍ التحديث...":"تحديث الآن"}</button>
      </div>
    </header>
    <main className="content exit-analytics-page">
      <section className="panel exit-period-panel no-print">
        <div><b>الفترة</b><span>اختر المدة التي تريد تحليل معدل الخروج خلالها.</span></div>
        <div className="exit-period-tabs">
          {[1,7,30].map(d=><button key={d} className={days===d?"active":""} onClick={()=>setDays(d)}>{d===1?"اليوم":d===7?"آخر 7 أيام":"آخر 30 يوم"}</button>)}
        </div>
      </section>

      {msg&&<div className="notice error">{msg}</div>}
      {!data?<section className="panel"><div className="empty">{busy?"جارٍ تحميل معدلات الخروج...":"لا توجد بيانات."}</div></section>:<>
        <section className="exit-kpi-grid">
          <article><span>نسبة الطلاب الذين خرجوا</span><strong>{pct(data.student_exit_rate_pct)}</strong><small>{n(data.unique_students).toLocaleString("ar-SA")} من {n(data.total_students).toLocaleString("ar-SA")} طالب</small></article>
          <article><span>مرات الخروج</span><strong>{n(data.exit_events).toLocaleString("ar-SA")}</strong><small>متوسط {n(data.avg_exits_per_day).toLocaleString("ar-SA")} مرة يوميًا</small></article>
          <article><span>متوسط مدة الخروج</span><strong>{mins(data.avg_minutes_per_exit)}</strong><small>لكل استئذان مسجل</small></article>
          <article><span>إجمالي مدة الخروج</span><strong>{mins(data.total_minutes)}</strong><small>خلال الفترة المختارة</small></article>
          <article><span>متوسط الخروج للطالب</span><strong>{n(data.avg_exits_per_exiting_student).toLocaleString("ar-SA",{maximumFractionDigits:1})}</strong><small>للطالب الذي سجل له خروج</small></article>
          <article className={data.currently_out>0?"alert":""}><span>خارج الفصل الآن</span><strong>{n(data.currently_out).toLocaleString("ar-SA")}</strong><small>{data.currently_out>0?"يحتاج متابعة حالية":"لا يوجد استئذان مفتوح"}</small></article>
        </section>

        {data.currently_out_students?.length>0&&<section className="panel current-out-panel">
          <div className="panel-title"><div><h3>الطلاب خارج الفصل الآن</h3><p>قائمة مباشرة بالاستئذانات المفتوحة حاليًا.</p></div><span className="counter">{data.currently_out_students.length}</span></div>
          <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>الصف / الفصل</th><th>الحصة</th><th>المعلم</th><th>وقت الخروج</th><th>المدة الحالية</th></tr></thead><tbody>
            {data.currently_out_students.map(x=><tr key={x.student_id}><td><b>{x.student_name}</b><small>{x.student_no}</small></td><td>{x.grade_name||"—"} — {x.class_name||"—"}</td><td>الحصة {x.lesson_no}</td><td>{x.teacher_name||"—"}</td><td>{time(x.exited_at)}</td><td><strong>{mins(x.current_minutes)}</strong></td></tr>)}
          </tbody></table></div>
        </section>}

        <section className="grid-2 exit-analysis-grid">
          <article className="panel">
            <div className="panel-title"><div><h3>اتجاه الخروج يوميًا</h3><p>عدد مرات الخروج والطلاب المختلفين في كل يوم.</p></div></div>
            <div className="exit-bars">
              {data.daily.map(x=><div className="exit-bar-row" key={x.day}><span>{date(x.day)}</span><div className="bar-track"><i style={{width:(n(x.exit_count)/maxDaily*100)+"%"}}/></div><b>{n(x.exit_count).toLocaleString("ar-SA")}</b><small>{n(x.unique_students).toLocaleString("ar-SA")} طالب</small></div>)}
            </div>
          </article>
          <article className="panel">
            <div className="panel-title"><div><h3>الخروج حسب الحصة</h3><p>يساعد في تحديد الحصص التي يكثر فيها الاستئذان.</p></div></div>
            <div className="exit-bars lesson-bars">
              {data.lessons.filter(x=>n(x.exit_count)>0).map(x=><div className="exit-bar-row" key={x.lesson_no}><span>حصة {x.lesson_no}</span><div className="bar-track"><i style={{width:(n(x.exit_count)/maxLesson*100)+"%"}}/></div><b>{n(x.exit_count).toLocaleString("ar-SA")}</b><small>متوسط {mins(x.avg_minutes)}</small></div>)}
              {!data.lessons.some(x=>n(x.exit_count)>0)&&<div className="empty">لا توجد حالات خروج في الفترة المختارة.</div>}
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-title"><div><h3>أعلى الطلاب في معدل الخروج</h3><p>مرتبة حسب عدد مرات الخروج ثم إجمالي مدة البقاء خارج الفصل.</p></div></div>
          {data.top_students.length?<div className="table-wrap"><table className="exit-ranking-table"><thead><tr><th>#</th><th>الطالب</th><th>الصف / الفصل</th><th>مرات الخروج</th><th>إجمالي المدة</th><th>متوسط المرة</th></tr></thead><tbody>
            {data.top_students.map((x,i)=><tr key={x.student_id}><td><b>{i+1}</b></td><td><b>{x.student_name}</b><small>{x.student_no}</small></td><td>{x.grade_name||"—"} — {x.class_name||"—"}</td><td><strong>{n(x.exit_count).toLocaleString("ar-SA")}</strong></td><td>{mins(x.total_minutes)}</td><td>{mins(x.avg_minutes)}</td></tr>)}
          </tbody></table></div>:<div className="empty">لا توجد حالات خروج في الفترة المختارة.</div>}
        </section>

        <section className="panel">
          <div className="panel-title"><div><h3>معدلات الخروج حسب الفصل</h3><p>النسبة = عدد طلاب الفصل الذين سجل لهم خروج ÷ إجمالي طلاب الفصل.</p></div></div>
          {data.classes.length?<div className="table-wrap"><table className="exit-class-table"><thead><tr><th>الصف</th><th>الفصل</th><th>طلاب الفصل</th><th>طلاب خرجوا</th><th>معدل الخروج</th><th>مرات الخروج</th><th>متوسط المدة</th></tr></thead><tbody>
            {data.classes.map(x=><tr key={x.class_id}><td>{x.grade_name||"—"}</td><td><b>{x.class_name||"—"}</b></td><td>{n(x.student_count).toLocaleString("ar-SA")}</td><td>{n(x.unique_students).toLocaleString("ar-SA")}</td><td><strong>{pct(x.exit_rate_pct)}</strong></td><td>{n(x.exit_count).toLocaleString("ar-SA")}</td><td>{mins(x.avg_minutes)}</td></tr>)}
          </tbody></table></div>:<div className="empty">لا توجد حالات خروج في الفترة المختارة.</div>}
        </section>
      </>}
    </main>
  </>;
}

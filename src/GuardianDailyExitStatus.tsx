import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./student-exit-tracker.css";

type ExitEvent={id:string;lesson_no:number;exited_at:string;returned_at?:string|null;duration_minutes:number;teacher_name?:string};
type ExitSummary={today:string;exit_count:number;currently_out:boolean;total_minutes:number;events:ExitEvent[]};

function clock(value?:string|null){
  if(!value)return "—";
  return new Date(value).toLocaleTimeString("ar-SA",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit"});
}
function minutesText(value:number){
  const n=Number(value||0);
  if(n>0&&n<1)return "أقل من دقيقة";
  return n.toLocaleString("ar-SA",{maximumFractionDigits:1})+" دقيقة";
}

export default function GuardianDailyExitStatus({studentId,studentNo}:{studentId:string;studentNo:string}){
  const[data,setData]=useState<ExitSummary|null>(null);
  const[error,setError]=useState("");

  async function load(){
    try{
      setError("");
      setData(await rpc<ExitSummary>("api_guardian_student_exit_today",{p_student_id:studentId,p_student_no:studentNo}));
    }catch(e){setError(niceError(e))}
  }

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return()=>window.clearInterval(timer);
  },[studentId,studentNo]);

  if(error)return null;
  if(!data)return <section className="guardian-attendance-card loading-card"><span>الحضور اليومي</span><p>جارٍ تحديث سجل الخروج من الفصل...</p></section>;

  const events=data.events||[];
  const noExit=Number(data.exit_count||0)===0;

  return <section className={"guardian-attendance-card "+(data.currently_out?"attention":noExit?"clear":"recorded")}>
    <div className="guardian-attendance-head">
      <div><span>الحضور اليومي</span><h3>{data.currently_out?"الطالب خارج الفصل الآن":noExit?"لم يسجل أي خروج من الفصل اليوم":"تم تسجيل خروج وعودة خلال اليوم"}</h3></div>
      <b>{noExit?"مستقر":minutesText(Number(data.total_minutes||0))}</b>
    </div>
    {noExit
      ?<p>لم يسجل المعلم أي استئذان أو خروج من الفصل اليوم.</p>
      :<><p>{data.currently_out?"يوجد استئذان مفتوح حاليًا، وتُحسب المدة حتى عودة الطالب.":"إجمالي مدة خروج الطالب من الفصل اليوم: "+minutesText(Number(data.total_minutes||0))+"."}</p>
        <div className="guardian-exit-events">
          {events.map(e=><article key={e.id}>
            <div><b>الحصة {e.lesson_no}</b><span>{e.teacher_name||"المعلم"}</span></div>
            <div><small>خرج {clock(e.exited_at)}</small><small>{e.returned_at?"عاد "+clock(e.returned_at):"لم يعد بعد"}</small></div>
            <strong>{minutesText(Number(e.duration_minutes||0))}</strong>
          </article>)}
        </div>
      </>}
  </section>;
}

import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./student-exit-tracker.css";

type ExitEvent={id:string;lesson_no:number;exited_at:string;returned_at?:string|null;duration_minutes:number;teacher_name?:string};
type ExitSummary={today:string;exit_count:number;currently_out:boolean;total_minutes:number;events:ExitEvent[]};
type Note={id:string;category_ar?:string;note_text?:string;teacher_name?:string};

function clock(value?:string|null){
  if(!value)return "—";
  return new Date(value).toLocaleTimeString("ar-SA",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit"});
}
function minutesText(value:number){
  const n=Number(value||0);
  if(n>0&&n<1)return "أقل من دقيقة";
  return n.toLocaleString("ar-SA",{maximumFractionDigits:1})+" دقيقة";
}
function riyadhDay(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>parts.find(x=>x.type===t)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
}
function noteStamp(text:string){
  const m=text.match(/وقت (?:الخروج|العودة):\s*(\d{2}:\d{2}:\d{2})\s*\((\d{4}-\d{2}-\d{2})\)/);
  return m?new Date(m[2]+"T"+m[1]+"+03:00").toISOString():"";
}
function noteLesson(text:string){
  const m=text.match(/الحصة رقم\s*(\d+)/);
  return m?Number(m[1]):1;
}
function fallbackSummary(notes:Note[]):ExitSummary{
  const today=riyadhDay();
  const rows=(notes||[]).filter(n=>String(n.category_ar||"").startsWith("استئذان:"))
    .map(n=>({n,at:noteStamp(String(n.note_text||""))}))
    .filter(x=>x.at&&x.at.slice(0,10)===today)
    .sort((a,b)=>a.at.localeCompare(b.at));
  const events:ExitEvent[]=[];
  for(const row of rows){
    const cat=String(row.n.category_ar||"");
    if(cat==="استئذان: خروج"){
      events.push({id:row.n.id,lesson_no:noteLesson(String(row.n.note_text||"")),exited_at:row.at,returned_at:null,duration_minutes:0,teacher_name:row.n.teacher_name});
    }else if(cat==="استئذان: عودة"){
      const e=[...events].reverse().find(x=>!x.returned_at);
      if(e){
        e.returned_at=row.at;
        e.duration_minutes=Math.max(0,(new Date(row.at).getTime()-new Date(e.exited_at).getTime())/60000);
      }
    }
  }
  const now=Date.now();
  const total=events.reduce((sum,e)=>sum+(e.returned_at?Number(e.duration_minutes||0):Math.max(0,(now-new Date(e.exited_at).getTime())/60000)),0);
  return {today,exit_count:events.length,currently_out:events.some(e=>!e.returned_at),total_minutes:total,events:events.sort((a,b)=>b.exited_at.localeCompare(a.exited_at))};
}

export default function GuardianDailyExitStatus({studentId,studentNo,notes=[]}:{studentId:string;studentNo:string;notes?:Note[]}){
  const[data,setData]=useState<ExitSummary|null>(null);
  const[error,setError]=useState("");

  async function load(){
    try{
      setError("");
      setData(await rpc<ExitSummary>("api_guardian_student_exit_today",{p_student_id:studentId,p_student_no:studentNo}));
    }catch(e){
      const fallback=fallbackSummary(notes);
      setData(fallback);
      if(!notes.length)setError(niceError(e));
    }
  }

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),60000);
    return()=>window.clearInterval(timer);
  },[studentId,studentNo,notes]);

  if(error&&!data)return null;
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
            <strong>{minutesText(e.returned_at?Number(e.duration_minutes||0):Math.max(0,(Date.now()-new Date(e.exited_at).getTime())/60000))}</strong>
          </article>)}
        </div>
      </>}
  </section>;
}

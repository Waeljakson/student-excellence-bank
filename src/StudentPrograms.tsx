import { useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./engagement.css";

const SCHOOL_LOGO=`${import.meta.env.BASE_URL}school-logo.png`;
const GUIDANCE_LOGO=`${import.meta.env.BASE_URL}guidance-logo.png`;
type Competition={id:string;title_ar:string;body_ar:string;starts_at:string;ends_at?:string|null;announcement_type?:string;criteria?:string[]};
type Student={name:string;grade_name:string;class_name:string};
type Membership={competition_id:string;joined_at:string};
type Special={type:string;title:string;body:string;starts_at?:string;ends_at?:string;status?:string;join_required:false;advice?:string[]};
type Programs={khameesna?:Special|null;behavioral?:Special|null};
const date=(v?:string|null)=>v?new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}):"—";

export default function StudentPrograms({competitions,student}:{competitions:Competition[];student:Student}){
  const[members,setMembers]=useState<Membership[]>([]);const[programs,setPrograms]=useState<Programs>({});const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  async function load(){try{const[m,p]=await Promise.all([rpc<Membership[]>("api_student_competition_memberships"),rpc<Programs>("api_student_program_banners")]);setMembers(m||[]);setPrograms(p||{})}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  const joined=useMemo(()=>new Set(members.map(x=>x.competition_id)),[members]);
  async function join(id:string){setBusy(id);setMsg("");try{await rpc("api_student_join_competition",{p_competition_id:id});setMsg("تم انضمامك للمسابقة بنجاح.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  const specials=[programs.khameesna,programs.behavioral].filter(Boolean) as Special[];
  if(!competitions.length&&!specials.length)return null;
  return <section className="student-programs-stack">
    {competitions.map((c,index)=><article className="competition-check-banner joinable" key={c.id}><div className="check-perforation top"/><div className="competition-check-side"><div className="competition-check-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span>مسابقة مدرسية</span><b>{String(index+1).padStart(2,"0")}</b></div><div className="competition-check-main"><div className="competition-check-kicker"><span>مخصصة لفصلك</span><em>{joined.has(c.id)?"منضم للمسابقة":"متاحة للانضمام"}</em></div><h2>{c.title_ar}</h2><p>{c.body_ar}</p>{c.criteria?.length?<div className="competition-check-criteria">{c.criteria.map((x,i)=><span key={i}><b>{i+1}</b>{x}</span>)}</div>:null}<div className="competition-check-footer"><div><small>تبدأ</small><b>{date(c.starts_at)}</b></div><div><small>تنتهي</small><b>{date(c.ends_at)}</b></div><div><small>الفصل</small><b>{student.grade_name} — فصل {student.class_name}</b></div></div><button className={joined.has(c.id)?"competition-join-btn joined":"competition-join-btn"} disabled={joined.has(c.id)||busy===c.id} onClick={()=>join(c.id)}>{busy===c.id?"جارٍ الانضمام...":joined.has(c.id)?"✓ أنت منضم للمسابقة":"انضم للمسابقة"}</button></div><div className="check-perforation bottom"/></article>)}
    {specials.map((p,i)=><article className={`competition-check-banner auto-program ${p.type==="KHAMEESNA"?"kh-banner":"behavior-banner"}`} key={p.type}><div className="check-perforation top"/><div className="competition-check-side"><div className="competition-check-logos"><img src={SCHOOL_LOGO}/><img src={GUIDANCE_LOGO}/></div><span>{p.type==="KHAMEESNA"?"مسابقة فصل":"برنامج سلوكي"}</span><b>{p.type==="KHAMEESNA"?"فصل":"✦"}</b></div><div className="competition-check-main"><div className="competition-check-kicker"><span>{p.type==="KHAMEESNA"?"أنت منضم تلقائيًا مع فصلك":"لا تحتاج إلى الانضمام"}</span><em>{p.status==="PAUSED"?"متوقفة مؤقتًا":"فعالة"}</em></div><h2>{p.title}</h2><p>{p.body}</p>{p.advice?.length?<div className="student-advice-grid">{p.advice.map((a,n)=><span key={n}><b>نصيحة {n+1}</b>{a}</span>)}</div>:null}<div className="competition-check-footer"><div><small>البداية</small><b>{date(p.starts_at)}</b></div><div><small>النهاية</small><b>{date(p.ends_at)}</b></div><div><small>طريقة المشاركة</small><b>{p.type==="KHAMEESNA"?"مع فصلك تلقائيًا":"بترشيحات المعلمين"}</b></div></div></div><div className="check-perforation bottom"/></article>)}
    {msg&&<div className="notice compact-notice">{msg}</div>}
  </section>;
}

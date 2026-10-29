import {useEffect,useRef,useState} from "react";
import {rpc} from "./client";
import type {PeriodNotice,PeriodNoticeChild} from "./PeriodNoticeViewer";
import "./period-notices.css";

type Celebration={student:string;notice:PeriodNotice;id:string};

// A guardian may see the celebration again every six hours, but only during
// the seven days following the publication of that specific period notice.
const GUARDIAN_REPEAT_MS=6*60*60*1000;
const GUARDIAN_VISIBLE_MS=7*24*60*60*1000;
function storedTime(key:string,fallback:Record<string,number>):number{
  try{
    const value=Number(localStorage.getItem(key));
    return Number.isFinite(value)&&value>0?value:(fallback[key]||0);
  }catch{return fallback[key]||0}
}
function rememberTime(key:string,value:number,fallback:Record<string,number>){
  fallback[key]=value;
  try{localStorage.setItem(key,String(value))}catch{/* Browser privacy mode: the current tab still respects the cooldown. */}
}

const particles=Array.from({length:54},(_,i)=>({
  left:`${(i*47+13)%100}%`,
  delay:`${((i*17)%30)/10}s`,
  duration:`${3+((i*7)%20)/10}s`,
  angle:`${(i*53)%360}deg`,
  color:["#efb638","#16a6bd","#e35d8e","#8266d5","#34bd81"][i%5],
  width:`${6+i%5}px`
}));
const labels=["","الأول","الثاني","الثالث","الرابع","الخامس"];
const fmt=(n:number|null|undefined)=>n==null?"—":Number(n).toLocaleString("ar-SA");

export default function PeriodNoticeCelebration({
  mode,children=[],loadOwn=false,guardianScope
}:{mode:"student"|"guardian";children?:PeriodNoticeChild[];loadOwn?:boolean;guardianScope?:string}){
  const [myChildren,setMyChildren]=useState<PeriodNoticeChild[]>(children);
  const [celebration,setCelebration]=useState<Celebration|null>(null);
  const [currentTime,setCurrentTime]=useState(()=>Date.now());
  const localTimes=useRef<Record<string,number>>({});
  const shownThisSession=useRef<Set<string>>(new Set());
  useEffect(()=>{
    setMyChildren(children);
  },[children.map(x=>x.id+":"+(x.period_notices||[]).map(n=>n.id+":"+String(n.grade_rank??n.school_rank)).join(",")).join("|")]);
  useEffect(()=>{
    if(!loadOwn)return;
    let active=true;
    rpc<{children:PeriodNoticeChild[]}>("api_period_notice_my")
      .then(r=>{if(active&&Array.isArray(r?.children))setMyChildren(r.children)})
      .catch(()=>{});
    return()=>{active=false};
  },[loadOwn]);
  useEffect(()=>{
    if(mode!=="guardian")return;
    const update=()=>{if(document.visibilityState==="visible")setCurrentTime(Date.now())};
    const interval=window.setInterval(update,60_000);
    window.addEventListener("focus",update);
    document.addEventListener("visibilitychange",update);
    return()=>{
      window.clearInterval(interval);
      window.removeEventListener("focus",update);
      document.removeEventListener("visibilitychange",update);
    };
  },[mode]);
  useEffect(()=>{
    if(celebration||document.visibilityState==="hidden")return;
    if(mode==="student"){
      for(const student of myChildren){
        const notice=(student.period_notices||[]).find(n=>
          Number(n.grade_rank??n.school_rank)>=1&&Number(n.grade_rank??n.school_rank)<=5);
        if(!notice)continue;
        const key=`period-notice-grade-congrats-student-${student.id}-${notice.id}`;
        if(shownThisSession.current.has(key))continue;
        try{if(sessionStorage.getItem(key)==="1")continue;sessionStorage.setItem(key,"1")}catch{}
        shownThisSession.current.add(key);
        setCelebration({student:student.name,notice,id:key});
        break;
      }
      return;
    }

    const parentId=guardianScope||myChildren.map(c=>c.id).sort().join("-");
    if(!parentId)return;
    const globalKey=`period-notice-grade-guardian-last-v1-${parentId}`;
    if(currentTime-storedTime(globalKey,localTimes.current)<GUARDIAN_REPEAT_MS)return;

    const eligible=myChildren.flatMap(student=>(student.period_notices||[])
      .filter(n=>Number(n.grade_rank??n.school_rank)>=1&&Number(n.grade_rank??n.school_rank)<=5)
      .map(notice=>{
        const publishedAt=new Date(notice.published_at).getTime();
        const id=`period-notice-grade-guardian-item-v1-${student.id}-${notice.id}`;
        return {student:student.name,notice,id,publishedAt,
          lastShown:storedTime(id,localTimes.current)};
      })
      .filter(x=>Number.isFinite(x.publishedAt)&&
        x.publishedAt<=currentTime&&currentTime-x.publishedAt<GUARDIAN_VISIBLE_MS&&
        currentTime-x.lastShown>=GUARDIAN_REPEAT_MS));
    if(!eligible.length)return;
    // If the guardian has multiple qualifying children, alternate celebrations.
    eligible.sort((a,b)=>a.lastShown-b.lastShown||b.publishedAt-a.publishedAt);
    const winner=eligible[0];
    rememberTime(globalKey,currentTime,localTimes.current);
    rememberTime(winner.id,currentTime,localTimes.current);
    setCelebration({student:winner.student,notice:winner.notice,id:winner.id});
  },[celebration,myChildren,mode,currentTime,guardianScope]);

  useEffect(()=>{
    if(!celebration)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setCelebration(null)};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[celebration]);
  if(!celebration)return null;
  const n=celebration.notice;const rank=Number(n.grade_rank??n.school_rank);
  return <div className="period-celebration-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCelebration(null)}}>
    <div className="period-confetti" aria-hidden="true">{particles.map((particle,i)=>
      <i key={i} style={{
        left:particle.left,animationDelay:particle.delay,animationDuration:particle.duration,
        backgroundColor:particle.color,width:particle.width,transform:`rotate(${particle.angle})`
      }}/>)}</div>
    <section className="period-celebration-box" role="dialog" aria-modal="true" aria-labelledby="notice-celebration-title" dir="rtl">
      <button type="button" className="period-celebration-close" onClick={()=>setCelebration(null)} aria-label="إغلاق التهنئة">×</button>
      <div className="period-celebration-medal" aria-hidden="true">🏆</div>
      <div className="period-celebration-eyebrow">من المتفوقين على مستوى الصف الدراسي</div>
      <h2 id="notice-celebration-title">{mode==="guardian"?"ألف مبروك تفوق ابنكم!":"ألف مبروك تفوقك!"}</h2>
      <h3>{celebration.student}</h3>
      <div className="period-celebration-grade">{n.grade||"الصف الدراسي"}</div>
      <p>{mode==="guardian"
        ?"يسعدنا أن نشارككم فرحة هذا الإنجاز المتميز. لقد حصل ابنكم على أحد المراكز الخمسة الأولى في صفه الدراسي."
        :"تعبك واجتهادك أثمرا تميزًا تستحق أن تفخر به. أنت من الخمسة الأوائل على مستوى صفك الدراسي!"}</p>
      <div className="period-celebration-ranking">
        <div><span>ترتيب الصف الدراسي</span><strong>{labels[rank]||fmt(rank)}</strong></div>
        <div><span>ترتيب الفصل</span><strong>{fmt(n.class_rank)}</strong></div>
      </div>
      <div className="period-celebration-wish">
        {mode==="guardian"?"نسأل الله أن يبارك لكم فيه، وأن يديم عليه التفوق والنجاح.":"واصل طريق التميز، والقادم أجمل بإذن الله."}
      </div>
      <button type="button" className="period-celebration-cta" onClick={()=>setCelebration(null)}>شكرًا، مشاهدة إشعار النتائج</button>
    </section>
  </div>;
}

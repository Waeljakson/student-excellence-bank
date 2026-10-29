import {useEffect,useRef,useState} from "react";
import {rpc} from "./client";
import type {PeriodNotice,PeriodNoticeChild} from "./PeriodNoticeViewer";
import "./period-notices.css";

type Celebration={student:string;notice:PeriodNotice;id:string};

// Every new guardian portal visit gets a celebration while the published
// result is within its seven-day announcement window.
const GUARDIAN_VISIBLE_MS=7*24*60*60*1000;

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
  // These refs reset when the portal is entered again, unlike sessionStorage.
  const shownThisVisit=useRef(false);
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

    if(shownThisVisit.current)return;
    const now=Date.now();
    const parentId=guardianScope||myChildren.map(c=>c.id).sort().join("-");
    if(!parentId)return;
    const eligible=myChildren.flatMap(student=>(student.period_notices||[])
      .filter(n=>Number(n.grade_rank??n.school_rank)>=1&&Number(n.grade_rank??n.school_rank)<=5)
      .map(notice=>({student:student.name,notice,publishedAt:new Date(notice.published_at).getTime()}))
      .filter(x=>Number.isFinite(x.publishedAt)&&x.publishedAt<=now&&now-x.publishedAt<GUARDIAN_VISIBLE_MS))
      .sort((a,b)=>b.publishedAt-a.publishedAt||a.student.localeCompare(b.student,"ar"));
    if(!eligible.length)return;
    // Rotate between qualifying children on subsequent portal visits; never
    // use browser storage to suppress a visit's congratulation.
    const cycleKey=`period-notice-guardian-cycle-v2-${parentId}`;
    let index=0;
    try{
      const saved=Number(localStorage.getItem(cycleKey));
      index=Number.isSafeInteger(saved)&&saved>=0?saved%eligible.length:0;
      localStorage.setItem(cycleKey,String((index+1)%eligible.length));
    }catch{/* Storage unavailable: still celebrate the current visit. */}
    const selected=eligible[index];
    shownThisVisit.current=true;
    setCelebration({student:selected.student,notice:selected.notice,
      id:`period-notice-grade-guardian-${selected.notice.id}`});
  },[celebration,myChildren,mode,guardianScope]);

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

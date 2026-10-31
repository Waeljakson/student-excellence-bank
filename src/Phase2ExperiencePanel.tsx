import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./phase2-messaging.css";

type Level={name:string;earned:number;balance:number;threshold:number;next_name:string|null;next_threshold:number|null;remaining:number;percent:number;levels:Array<{name:string;points:number}>};
type Message={id:string;title_ar:string;body_ar:string;kind:"GENERAL"|"ALERT"|"CONGRATULATION";audience:string;published_at:string;expires_at:string};
type Experience={school_id:string;student_id:string;level:Level;messages:Message[]};
type Props={mode:"guardian"|"student";studentNo?:string;schoolCode?:string;studentId?:string;compact?:boolean};
const fmt=(n:number)=>Number(n||0).toLocaleString("ar-SA");
const date=(v:string)=>new Date(v).toLocaleDateString("ar-SA",{dateStyle:"medium"});
function safeCache(k:string){try{return localStorage.getItem(k)}catch{return null}}
function saveCache(k:string){try{localStorage.setItem(k,"1")}catch{}}

export default function Phase2ExperiencePanel({mode,studentNo,schoolCode,studentId,compact=false}:Props){
 const[data,setData]=useState<Experience|null>(null),[error,setError]=useState("");
 const[loading,setLoading]=useState(true),[expanded,setExpanded]=useState(false),[tick,setTick]=useState(0),[celebration,setCelebration]=useState<Message|null>(null),[levelCelebration,setLevelCelebration]=useState(false);
 useEffect(()=>{
 let live=true;setLoading(true);setData(null);setError("");setCelebration(null);setLevelCelebration(false);
 const request=mode==="guardian"
 ?(studentNo&&schoolCode?rpc<Experience>("api_phase2_guardian_experience",{p_student_no:studentNo,p_school_code:schoolCode}):Promise.resolve(null))
 :rpc<Experience>("api_phase2_student_experience");
 request.then(x=>{
 if(!live||!x)return;setData(x);
 const today=Date.now();
 const party=(x.messages||[]).find(m=>m.kind==="CONGRATULATION" &&
   today-new Date(m.published_at).getTime()<=3*86400000 &&
   today>=new Date(m.published_at).getTime() &&
   !safeCache("bank-v2-celebration:"+x.school_id+":"+x.student_id+":"+m.id));
 if(party)setCelebration(party);
 else if(x.level && Number(x.level.threshold)>0 && !safeCache("bank-v2-tier:"+x.school_id+":"+x.student_id+":"+x.level.threshold))setLevelCelebration(true);
 }).catch(e=>{if(live)setError(niceError(e))}).finally(()=>{if(live)setLoading(false)});
 return()=>{live=false};
 },[mode,studentNo,schoolCode,studentId,tick]);
 useEffect(()=>{const onFocus=()=>{if(document.visibilityState==="visible")setTick(x=>x+1)};window.addEventListener("focus",onFocus);return()=>window.removeEventListener("focus",onFocus)},[]);
 const messages=data?.messages||[];
 const level=data?.level;
 function closeCelebration(){if(celebration&&data)saveCache("bank-v2-celebration:"+data.school_id+":"+data.student_id+":"+celebration.id);setCelebration(null)}
 function closeLevelCelebration(){if(data?.level)saveCache("bank-v2-tier:"+data.school_id+":"+data.student_id+":"+data.level.threshold);setLevelCelebration(false)}
 return <div className="p2-experience" dir="rtl">
 {loading&&!data&&<p className="p2-muted">جارٍ تحديث مستويات التميز والإشعارات...</p>}
 {error&&<p className="p2-error">تعذر تحديث الإشعارات والمستويات: {error}<button type="button" onClick={()=>setTick(x=>x+1)}>إعادة المحاولة</button></p>}
 {level&&<section className="p2-level-card">
 <div className="p2-level-top"><div><small>رحلتك في بنك التميز</small><h3>مستوى {level.name}</h3><p>{fmt(level.earned)} نقطة تميز مكتسبة · الرصيد المتاح {fmt(level.balance)} نقطة</p></div><span className="p2-level-seal" aria-hidden="true">★</span></div>
 <div className="p2-progress" role="progressbar" aria-valuenow={Number(level.percent)} aria-valuemin={0} aria-valuemax={100} aria-label="التقدم للمستوى التالي"><i style={{width:Math.min(100,Math.max(0,Number(level.percent)))+"%"}}/></div>
 <div className="p2-progress-label">{level.next_name?<><span>متبقّي {fmt(level.remaining)} نقطة للوصول إلى {level.next_name}</span><b>{fmt(level.percent)}٪</b></>:<b>وصلت إلى أعلى مستوى حاليًا — سفير التميز</b>}</div>
 {!compact&&<div className="p2-level-roadmap">{(level.levels||[]).map(v=><span key={v.name} className={level.earned>=v.points?"achieved":""}>{v.name} <small>{fmt(v.points)}</small></span>)}</div>}
 <p className="p2-level-note">المستويات تُحتسب من النقاط المكتسبة بعد استبعاد العمليات المعكوسة، ولا تنخفض عند استبدال النقاط بمكافآت.</p>
 </section>}
 <section className="p2-inbox"><header><div><small>مركز إشعارات المدرسة</small><h3>رسائل المدرسة والتهاني</h3></div><div className="p2-inbox-tools"><b>{fmt(messages.length)} إشعار</b><button type="button" onClick={()=>setTick(x=>x+1)}>تحديث ↻</button></div></header>
 {messages.length>0?<div className="p2-inbox-list">{(expanded?messages:messages.slice(0,3)).map(m=><article key={m.id} className={"p2-inbox-item "+m.kind.toLowerCase()}>
 <small>{m.kind==="CONGRATULATION"?"تهنئة وتكريم":m.kind==="ALERT"?"تنبيه من المدرسة":"إعلان مدرسي"} · {date(m.published_at)}</small>
 <h4>{m.title_ar}</h4><p>{m.body_ar}</p></article>)}</div>:<div className="p2-empty">لا توجد إشعارات جديدة موجهة لهذا الطالب في الوقت الحالي.</div>}
 {messages.length>3&&<button type="button" className="p2-more" onClick={()=>setExpanded(x=>!x)}>{expanded?"عرض أحدث 3":"عرض كل الإشعارات ("+messages.length+")"}</button>}
 </section>
 {levelCelebration&&level&&<div className="p2-celebrate-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeLevelCelebration()}}>
 <div className="p2-celebrate" role="dialog" aria-modal="true" aria-label="الترقي لمستوى جديد">
 <div className="p2-confetti" aria-hidden="true">✦ ★ ✦ ★ ✦</div><span className="p2-celebrate-icon">★</span><small>ترقية في بنك التميز</small>
 <h2>أحسنت! وصلت إلى المستوى {level.name}</h2>
 <p>حققت {fmt(level.earned)} نقطة تميز مكتسبة. استمر في طريق الإنجاز!</p>
 <button type="button" onClick={closeLevelCelebration}>مواصلة التميز</button></div></div>}
 {celebration&&<div className="p2-celebrate-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeCelebration()}}>
 <div className="p2-celebrate" role="dialog" aria-modal="true" aria-label="تهنئة من المدرسة">
 <div className="p2-confetti" aria-hidden="true">✦ ★ ✦ ★ ✦</div><span className="p2-celebrate-icon">★</span><small>بنك التميز الطلابي</small><h2>{celebration.title_ar}</h2><p>{celebration.body_ar}</p><button type="button" onClick={closeCelebration}>شكرًا على التهنئة</button>
 </div></div>}
 </div>;
}

import { FormEvent, useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./feature-upgrade.css";

type Board={available:boolean;can_manage?:boolean;competition_running?:boolean;competition_id?:string;name_ar?:string;week_no?:number;starts_on?:string;ends_on?:string;reward?:string;status?:"UPCOMING"|"ACTIVE"|"ENDED"|"PAUSED";criteria?:Array<{key:string;label:string;weight:number;max_score:number;sort_order?:number}>;allowed_classes?:Array<{class_id:string;grade_name:string;class_name:string}>;standings?:Array<{class_id:string;grade_name:string;class_name:string;score:number;evaluations:number}>;recent?:Array<{id:string;evaluation_date:string;total_score:number;cleanliness_score:number;attendance_score:number;discipline_score:number;homework_score:number;behavior_score:number;note?:string;created_at:string;class_name:string;grade_name:string;evaluator_name:string}>;weeks?:Array<{id:string;week_no:number;name_ar:string;starts_on:string;ends_on:string;status:string}>};

const labels={cleanliness:"نظافة الفصل",attendance:"الحضور وعدم التأخر",discipline:"الانضباط",homework:"إنجاز الواجبات",behavior:"السلوك"};
function date(v?:string){return v?new Date(v+(/T/.test(v)?"":"T12:00:00")).toLocaleDateString("ar-SA",{day:"numeric",month:"long"}):"—"}

export default function KhameesnaCompetition(){
  const[data,setData]=useState<Board|null>(null);const[error,setError]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);const[controlBusy,setControlBusy]=useState(false);const[classId,setClassId]=useState("");const[note,setNote]=useState("");const[scores,setScores]=useState({cleanliness:10,attendance:10,discipline:10,homework:10,behavior:10});
  async function load(){setError("");try{setData(await rpc<Board>("api_khameesna_competition_board"))}catch(e){setError(niceError(e))}}
  useEffect(()=>{load()},[]);
  function score(name:keyof typeof scores,value:string){setScores(v=>({...v,[name]:Math.max(0,Math.min(10,Number(value)||0))}))}
  async function submit(e:FormEvent){e.preventDefault();if(!classId)return;setBusy(true);setMsg("");try{const r:any=await rpc("api_submit_khameesna_evaluation",{p_class_id:classId,p_cleanliness:scores.cleanliness,p_attendance:scores.attendance,p_discipline:scores.discipline,p_homework:scores.homework,p_behavior:scores.behavior,p_note:note||null});setMsg(`تم تسجيل تقييم الفصل للأسبوع ${r.week_no}. الدرجة: ${r.score} من 100.`);setNote("");await load()}catch(e){setMsg(niceError(e))}finally{setBusy(false)}}
  async function setRunning(action:"START"|"STOP"){
    if(controlBusy)return;
    const text=action==="START"?"إطلاق":"إيقاف";
    if(!window.confirm(`تأكيد ${text} مسابقة خميسنا غير؟`))return;
    setControlBusy(true);setMsg("");
    try{const r:any=await rpc("api_set_khameesna_running",{p_action:action});setMsg(action==="START"?`تم إطلاق مسابقة خميسنا غير. تم تفعيل ${r.affected_weeks||0} أسبوعًا.`:"تم إيقاف مسابقة خميسنا غير. لن يتم قبول أي تقييمات حتى إعادة إطلاقها.");await load()}catch(e){setMsg(niceError(e))}finally{setControlBusy(false)}
  }
  if(error)return <><header className="topbar"><div><h1>خميسنا غير</h1></div></header><main className="content"><div className="notice error">{error}</div></main></>;
  if(!data)return <div className="full-center"><div className="loader"/><p>جارٍ تحميل خميسنا غير...</p></div>;
  if(!data.available)return <><header className="topbar"><div><h1>خميسنا غير</h1><p>مسابقة الفصول الأسبوعية</p></div></header><main className="content"><div className="panel empty">لم يتم إصدار أسابيع المسابقة بعد.</div></main></>;
  const total=scores.cleanliness+scores.attendance+scores.discipline+scores.homework+scores.behavior;
  const statusText=data.status==="ACTIVE"?"الأسبوع مفتوح للتقييم":data.status==="PAUSED"?"المسابقة متوقفة يدويًا":data.status==="UPCOMING"?"الأسبوع القادم":"انتهى الأسبوع";
  return <><header className="topbar"><div><h1>🏆 خميسنا غير</h1><p>الفصل المثالي — من الأسبوع الخامس إلى الأسبوع السابع عشر</p></div></header><main className="content khameesna-v2">
    <section className="kh-v2-hero panel"><div><span className={`kh-status ${data.status?.toLowerCase()}`}>{statusText}</span><h2>{data.name_ar}</h2><p>{date(data.starts_on)} — {date(data.ends_on)}</p><b>{data.reward}</b>{data.can_manage&&<div className="kh-admin-controls no-print"><span>تحكم مدير النظام</span>{data.competition_running?<button type="button" className="btn ghost" disabled={controlBusy} onClick={()=>setRunning("STOP")}>{controlBusy?"جارٍ التنفيذ...":"إيقاف المسابقة"}</button>:<button type="button" className="btn primary" disabled={controlBusy} onClick={()=>setRunning("START")}>{controlBusy?"جارٍ التنفيذ...":"إطلاق المسابقة"}</button>}</div>}</div><div className="kh-score-ring"><strong>{data.week_no}</strong><span>رقم الأسبوع</span></div></section>

    {data.status==="PAUSED"&&<section className="panel"><div className="notice error">المسابقة متوقفة حاليًا بقرار مدير النظام. لا يمكن للمعلمين تسجيل تقييمات حتى إعادة إطلاقها.</div></section>}

    <section className="panel"><div className="panel-title"><div><h3>معايير التقييم</h3><p>خمسة معايير متساوية. كل معيار من 10 درجات، والنتيجة النهائية من 100.</p></div></div><div className="kh-criteria-grid">{data.criteria?.map(c=><article key={c.key}><span>{c.sort_order}</span><b>{c.label}</b><small>{c.weight}% من النتيجة</small>{c.key==="ATTENDANCE"&&<em>10/10 عند عدم وجود غياب أو تأخر</em>}</article>)}</div></section>

    {data.status==="ACTIVE"&&<section className="panel"><div className="panel-title"><div><h3>تقييم فصل اليوم</h3><p>مسموح تقييم الفصل مرة واحدة يوميًا من حسابك. الفصول الظاهرة هي المسندة لك فقط.</p></div><span className="counter">{total*2}/100</span></div><form className="kh-eval-form" onSubmit={submit}><label>الفصل<select required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">اختر الفصل</option>{data.allowed_classes?.map(c=><option key={c.class_id} value={c.class_id}>{c.grade_name} — فصل {c.class_name}</option>)}</select></label><div className="kh-score-inputs">{(Object.keys(scores) as Array<keyof typeof scores>).map(k=><label key={k}><span>{labels[k]}</span><input type="number" min="0" max="10" required value={scores[k]} onChange={e=>score(k,e.target.value)}/><small>من 10</small></label>)}</div><label>ملاحظة — اختياري<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="سبب خفض درجة أي معيار أو ملاحظة إيجابية"/></label><button className="btn primary" disabled={busy||!classId}>{busy?"جارٍ الحفظ...":"اعتماد تقييم اليوم"}</button></form></section>}

    <section className="panel"><div className="panel-title"><div><h3>ترتيب الفصول</h3><p>الترتيب حسب متوسط التقييمات؛ زيادة عدد التقييمات لا تعطي ميزة غير عادلة.</p></div></div><div className="table-wrap"><table><thead><tr><th>#</th><th>الصف</th><th>الفصل</th><th>متوسط الدرجة</th><th>عدد التقييمات</th></tr></thead><tbody>{data.standings?.map((s,i)=><tr key={s.class_id}><td><b>{i+1}</b></td><td>{s.grade_name}</td><td>فصل {s.class_name}</td><td><strong>{Number(s.score).toFixed(1)} / 100</strong></td><td>{s.evaluations}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-title"><div><h3>أسابيع المسابقة</h3><p>الأسبوع الخامس حتى السابع عشر.</p></div></div><div className="kh-weeks-strip">{data.weeks?.map(w=><div key={w.id} className={w.status.toLowerCase()}><b>الأسبوع {w.week_no}</b><small>{date(w.starts_on)} — {date(w.ends_on)}</small></div>)}</div></section>
    {data.recent&&data.recent.length>0&&<section className="panel"><h3>آخر التقييمات</h3><div className="kh-recent">{data.recent.map(r=><article key={r.id}><div><b>{r.grade_name} — فصل {r.class_name}</b><small>{r.evaluator_name} · {date(r.evaluation_date)}</small></div><strong>{Number(r.total_score).toFixed(0)}</strong></article>)}</div></section>}
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>;
}

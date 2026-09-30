import { FormEvent, useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import { getCurrentSchoolName } from "./school-brand";
import "./feature-upgrade.css";

type WinnerStudent={student_id:string;student_no:string;student_name:string;guardian_name:string;approved:boolean;approved_at?:string|null};
type Winner={winner_id:string;competition_id:string;class_id:string;grade_name:string;class_name:string;final_score:number;trip_date:string;approved_at:string;student_count:number;consent_count:number;students:WinnerStudent[]};
type Board={available:boolean;can_manage?:boolean;competition_running?:boolean;competition_id?:string;name_ar?:string;week_no?:number;starts_on?:string;ends_on?:string;reward?:string;status?:"UPCOMING"|"ACTIVE"|"ENDED"|"PAUSED";criteria?:Array<{key:string;label:string;weight:number;max_score:number;sort_order?:number}>;allowed_classes?:Array<{class_id:string;grade_name:string;class_name:string}>;standings?:Array<{class_id:string;grade_name:string;class_name:string;score:number;evaluations:number}>;recent?:Array<{id:string;evaluation_date:string;total_score:number;cleanliness_score:number;attendance_score:number;discipline_score:number;homework_score:number;behavior_score:number;note?:string;created_at:string;class_name:string;grade_name:string;evaluator_name:string}>;weeks?:Array<{id:string;week_no:number;name_ar:string;starts_on:string;ends_on:string;status:string}>;winner?:Winner|null};

const labels={cleanliness:"نظافة الفصل",attendance:"الحضور وعدم التأخر",discipline:"الانضباط",homework:"إنجاز الواجبات",behavior:"السلوك"};
function date(v?:string){return v?new Date(v+(/T/.test(v)?"":"T12:00:00")).toLocaleDateString("ar-SA",{day:"numeric",month:"long"}):"—"}

export default function KhameesnaCompetition(){
  const schoolName=getCurrentSchoolName();
  const[data,setData]=useState<Board|null>(null);const[error,setError]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);const[controlBusy,setControlBusy]=useState(false);const[winnerBusy,setWinnerBusy]=useState("");const[classId,setClassId]=useState("");const[note,setNote]=useState("");const[scores,setScores]=useState({cleanliness:10,attendance:10,discipline:10,homework:10,behavior:10});
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
  async function approveWinner(row:{class_id:string;grade_name:string;class_name:string;score:number}){
    if(!data?.competition_id||winnerBusy)return;
    const label=`${row.grade_name} — فصل ${row.class_name}`;
    if(!window.confirm(`اعتماد ${label} فائزًا في مسابقة خميسنا غير؟ بعد الاعتماد ستظهر تهنئة ونموذج موافقة الرحلة في بوابة أولياء الأمور لطلاب الفصل.`))return;
    setWinnerBusy(row.class_id);setMsg("");
    try{
      const r:any=await rpc("api_set_khameesna_running",{p_action:`APPROVE_WINNER|${data.competition_id}|${row.class_id}`});
      setMsg(`تم اعتماد ${label} فصلًا فائزًا. تم نشر نموذج موافقة ولي الأمر للرحلة بتاريخ ${date(r.trip_date)}.`);
      await load();
    }catch(e){setMsg(niceError(e))}finally{setWinnerBusy("")}
  }
  function printConsents(){
    const winner=data?.winner;
    if(!winner)return;
    const approved=(winner.students||[]).filter(x=>x.approved);
    if(!approved.length){setMsg("لا توجد موافقات مسجلة للطباعة حتى الآن.");return}
    const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]||m));
    const schoolLogo=location.origin+import.meta.env.BASE_URL+"school-logo.png";
    const guidanceLogo=location.origin+import.meta.env.BASE_URL+"guidance-logo.png";
    const forms=approved.map((x,i)=>`<section class="form"><header><img src="${esc(schoolLogo)}"><div><small>${esc(schoolName)}</small><h1>نموذج موافقة ولي أمر</h1><h2>رحلة الفصل الفائز — مسابقة خميسنا غير</h2></div><img src="${esc(guidanceLogo)}"></header><div class="badge">موافقة إلكترونية معتمدة</div><p>أقر أنا ولي أمر الطالب <b>${esc(x.student_name)}</b>، رقم الطالب <b>${esc(x.student_no)}</b>، بموافقتي على مشاركته في الرحلة المجانية المخصصة للفصل الفائز <b>${esc(winner.grade_name)} — فصل ${esc(winner.class_name)}</b> ضمن مسابقة <b>خميسنا غير</b>، والمقررة يوم الخميس الموافق <b>${esc(date(winner.trip_date))}</b>.</p><div class="meta"><span><b>ولي الأمر:</b> ${esc(x.guardian_name||"ولي أمر الطالب")}</span><span><b>تاريخ الموافقة:</b> ${esc(x.approved_at?new Date(x.approved_at).toLocaleString("ar-SA"):"—")}</span><span><b>الحالة:</b> موافق</span></div><footer><span>تم تسجيل هذه الموافقة إلكترونيًا من خلال بوابة ولي الأمر</span><span>التوجيه الطلابي</span></footer></section>${i<approved.length-1?'<div class="page-break"></div>':''}`).join("");
    const w=window.open("","_blank","width=950,height=850");
    if(!w)return;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>موافقات رحلة خميسنا غير</title><style>@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{margin:0;font-family:"Cairo",Tahoma,Arial,sans-serif;color:#20323a;background:#fff}.form{min-height:245mm;border:1.5px solid #d7e2e4;border-radius:18px;padding:22px;position:relative}.form header{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:3px solid #0b7562;padding-bottom:14px}.form header img{width:64px;height:64px;object-fit:contain;justify-self:center}.form header div{text-align:center}.form header small{font-size:11px;color:#546d77}.form h1{margin:5px 0 2px;font-size:24px;color:#173f52}.form h2{margin:0;font-size:13px;color:#0b7562}.badge{width:max-content;margin:22px auto 16px;padding:8px 15px;border-radius:999px;background:#e6f4ef;color:#0a705e;font-weight:800}.form p{font-size:15px;line-height:2.25;margin:26px 8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}.meta span{border:1px solid #dfe8eb;border-radius:10px;padding:12px;background:#f8fbfb;font-size:12px}.form footer{position:absolute;bottom:20px;right:22px;left:22px;display:flex;justify-content:space-between;border-top:1px solid #d9e3e6;padding-top:10px;font-size:10px;color:#6f8189}.page-break{break-after:page;page-break-after:always}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${forms}<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
    w.document.close();
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

    <section className="panel"><div className="panel-title"><div><h3>ترتيب الفصول</h3><p>الترتيب حسب متوسط التقييمات؛ مدير النظام يختار ويعتمد الفصل الفائز.</p></div></div><div className="table-wrap"><table><thead><tr><th>#</th><th>الصف</th><th>الفصل</th><th>متوسط الدرجة</th><th>عدد التقييمات</th>{data.can_manage&&<th>اعتماد النتيجة</th>}</tr></thead><tbody>{data.standings?.map((s,i)=><tr key={s.class_id} className={data.winner?.class_id===s.class_id?"kh-winner-row":""}><td><b>{i+1}</b></td><td>{s.grade_name}</td><td>فصل {s.class_name}</td><td><strong>{Number(s.score).toFixed(1)} / 100</strong></td><td>{s.evaluations}</td>{data.can_manage&&<td>{data.winner?.class_id===s.class_id?<span className="kh-winner-badge">✓ الفصل الفائز</span>:<button type="button" className="mini-btn" disabled={!!winnerBusy} onClick={()=>approveWinner(s)}>{winnerBusy===s.class_id?"جارٍ الاعتماد...":"اعتماد فائز"}</button>}</td>}</tr>)}</tbody></table></div></section>
    {data.winner&&<section className="panel kh-winner-panel"><div className="kh-winner-title"><div><span>🏆 الفصل الفائز المعتمد</span><h3>{data.winner.grade_name} — فصل {data.winner.class_name}</h3><p>تم نشر تهنئة ونموذج موافقة الرحلة تلقائيًا في بوابة ولي الأمر لكل طلاب الفصل.</p></div><div><small>موعد الرحلة</small><strong>الخميس {date(data.winner.trip_date)}</strong></div></div><div className="kh-consent-stats"><article><span>طلاب الفصل</span><b>{data.winner.student_count}</b></article><article><span>الموافقات المستلمة</span><b>{data.winner.consent_count}</b></article><article><span>بانتظار الموافقة</span><b>{Math.max(Number(data.winner.student_count||0)-Number(data.winner.consent_count||0),0)}</b></article></div><div className="kh-consent-list"><div className="kh-consent-list-head"><b>موافقات أولياء الأمور</b><button type="button" className="btn ghost" onClick={printConsents} disabled={!data.winner.consent_count}>طباعة نماذج الموافقات</button></div><div className="table-wrap"><table><thead><tr><th>الطالب</th><th>رقم الطالب</th><th>ولي الأمر</th><th>الحالة</th><th>وقت الموافقة</th></tr></thead><tbody>{data.winner.students?.map(st=><tr key={st.student_id}><td>{st.student_name}</td><td>{st.student_no}</td><td>{st.guardian_name}</td><td>{st.approved?<span className="kh-consent-ok">✓ موافق</span>:<span className="kh-consent-wait">بانتظار الرد</span>}</td><td>{st.approved_at?new Date(st.approved_at).toLocaleString("ar-SA"):"—"}</td></tr>)}</tbody></table></div></div></section>}

    <section className="panel"><div className="panel-title"><div><h3>أسابيع المسابقة</h3><p>الأسبوع الخامس حتى السابع عشر.</p></div></div><div className="kh-weeks-strip">{data.weeks?.map(w=><div key={w.id} className={w.status.toLowerCase()}><b>الأسبوع {w.week_no}</b><small>{date(w.starts_on)} — {date(w.ends_on)}</small></div>)}</div></section>
    {data.recent&&data.recent.length>0&&<section className="panel"><h3>آخر التقييمات</h3><div className="kh-recent">{data.recent.map(r=><article key={r.id}><div><b>{r.grade_name} — فصل {r.class_name}</b><small>{r.evaluator_name} · {date(r.evaluation_date)}</small></div><strong>{Number(r.total_score).toFixed(0)}</strong></article>)}</div></section>}
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>;
}

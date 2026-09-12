import { FormEvent, useEffect, useMemo, useState } from "react";
import { niceError, rpc } from "./client";
import "./referrals.css";

type Student={id:string;student_no:string;name:string;grade_name:string;class_name:string;points:number};
type Referral={
  id:string;referral_no:string;target_role:"VICE_PRINCIPAL"|"GUIDANCE_COUNSELOR";target_label:string;
  subject_ar:string;incident_date:string;violation_text:string;violation_category:string;violation_category_label:string;
  occurrence_type:string;occurrence_label:string;violation_explanation:string;
  teacher_action_1?:string|null;teacher_action_date_1?:string|null;teacher_action_2?:string|null;teacher_action_date_2?:string|null;teacher_action_3?:string|null;teacher_action_date_3?:string|null;
  status:"OPEN"|"COMPLETED";deducted_points:number;deduction_note?:string|null;deducted_at?:string|null;
  completion_note?:string|null;completed_at?:string|null;created_at:string;
  student_id:string;student_no:string;student_name:string;grade_name:string;class_name:string;teacher_name:string;
  deducted_by_name?:string|null;completed_by_name?:string|null;wallet_points:number;
};

type Props={roles:string[];students:Student[];profileName:string};
const today=()=>new Date().toISOString().slice(0,10);
const fmt=(v?:string|null)=>v?new Date(v).toLocaleDateString("ar-SA",{year:"numeric",month:"short",day:"numeric"}):"—";
const dayName=(v:string)=>new Date(`${v}T12:00:00`).toLocaleDateString("ar-SA",{weekday:"long"});

export default function ReferralCenter({roles,students,profileName}:Props){
  const isTeacher=roles.includes("TEACHER");
  const canHandle=roles.includes("VICE_PRINCIPAL")||roles.includes("GUIDANCE_COUNSELOR");
  const[tab,setTab]=useState<"NEW"|"OPEN"|"COMPLETED">(isTeacher&&!canHandle?"NEW":"OPEN");
  const[items,setItems]=useState<Referral[]>([]);const[loading,setLoading]=useState(true);const[globalMsg,setGlobalMsg]=useState("");
  const[q,setQ]=useState("");const[studentId,setStudentId]=useState("");const[targetRole,setTargetRole]=useState<"VICE_PRINCIPAL"|"GUIDANCE_COUNSELOR">("VICE_PRINCIPAL");
  const[subject,setSubject]=useState("");const[incidentDate,setIncidentDate]=useState(today());const[category,setCategory]=useState<"EDUCATIONAL"|"BEHAVIORAL">("BEHAVIORAL");const[occurrence,setOccurrence]=useState<"FIRST"|"REPEATED">("FIRST");
  const[violation,setViolation]=useState("");const[explanation,setExplanation]=useState("");
  const[a1,setA1]=useState("");const[d1,setD1]=useState(today());const[a2,setA2]=useState("");const[d2,setD2]=useState(today());const[a3,setA3]=useState("");const[d3,setD3]=useState(today());const[submitting,setSubmitting]=useState(false);
  const[deductDraft,setDeductDraft]=useState<Record<string,string>>({});const[noteDraft,setNoteDraft]=useState<Record<string,string>>({});const[completeDraft,setCompleteDraft]=useState<Record<string,string>>({});const[actionBusy,setActionBusy]=useState("");

  async function load(){setLoading(true);try{const data=await rpc<Referral[]>("api_student_referrals",{p_status:"ALL"});setItems(Array.isArray(data)?data:[])}catch(e){setGlobalMsg(niceError(e))}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);

  const filteredStudents=useMemo(()=>students.filter(s=>`${s.name} ${s.student_no} ${s.grade_name} ${s.class_name}`.includes(q.trim())).slice(0,100),[students,q]);
  const open=items.filter(x=>x.status==="OPEN");const completed=items.filter(x=>x.status==="COMPLETED");

  async function createReferral(e:FormEvent){e.preventDefault();setGlobalMsg("");if(!studentId)return;setSubmitting(true);try{
    const result=await rpc<any>("api_create_student_referral",{p_student_id:studentId,p_target_role:targetRole,p_subject_ar:subject,p_incident_date:incidentDate,p_violation_text:violation,p_violation_category:category,p_occurrence_type:occurrence,p_violation_explanation:explanation,p_action_1:a1,p_action_date_1:d1,p_action_2:a2||null,p_action_date_2:a2?d2:null,p_action_3:a3||null,p_action_date_3:a3?d3:null});
    setGlobalMsg(`تم إرسال التحويل رقم ${result.referral_no} إلى ${targetRole==="VICE_PRINCIPAL"?"وكيل المدرسة":"الموجه الطلابي"}.`);
    setStudentId("");setQ("");setSubject("");setViolation("");setExplanation("");setA1("");setA2("");setA3("");setOccurrence("FIRST");await load();setTab("OPEN");
  }catch(err){setGlobalMsg(niceError(err))}finally{setSubmitting(false)}}

  async function deduct(r:Referral){const points=Number(deductDraft[r.id]||0);if(!points)return;setActionBusy(r.id+"d");setGlobalMsg("");try{await rpc("api_referral_deduct_points",{p_referral_id:r.id,p_points:points,p_note:noteDraft[r.id]||null});setGlobalMsg(`تم خصم ${points} نقطة من رصيد ${r.student_name} وتوثيقها على التحويل ${r.referral_no}.`);await load()}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}
  async function complete(r:Referral){setActionBusy(r.id+"c");setGlobalMsg("");try{await rpc("api_complete_student_referral",{p_referral_id:r.id,p_completion_note:completeDraft[r.id]||null});setGlobalMsg(`تم إنهاء التحويل ${r.referral_no} ونقله إلى أرشيف التحويلات المنتهية.`);await load();setTab("COMPLETED")}catch(e){setGlobalMsg(niceError(e))}finally{setActionBusy("")}}

  return <><header className="topbar"><div><h1>تحويلات الطلاب</h1><p>{isTeacher?"استمارة تحويل رقمية ومتابعة الإجراء":"التحويلات المحالة إليك واتخاذ الإجراء"}</p></div><div className="referral-head-badge"><b>{open.length}</b><span>تحويل مفتوح</span></div></header><main className="content referrals-page">
    <section className="referral-tabs no-print">
      {isTeacher&&<button className={tab==="NEW"?"active":""} onClick={()=>setTab("NEW")}>تحويل جديد</button>}
      <button className={tab==="OPEN"?"active":""} onClick={()=>setTab("OPEN")}>{canHandle?"الوارد الحالي":"تحويلاتي المفتوحة"}<span>{open.length}</span></button>
      <button className={tab==="COMPLETED"?"active":""} onClick={()=>setTab("COMPLETED")}>التحويلات المنتهية<span>{completed.length}</span></button>
    </section>

    {globalMsg&&<div className="notice referral-notice">{globalMsg}</div>}

    {tab==="NEW"&&isTeacher&&<form className="panel referral-form" onSubmit={createReferral}>
      <div className="referral-form-title"><div><span>استمارة رقمية</span><h2>تحويل طالب</h2><p>بيانات المعلم والتاريخ تُوثق آليًا ولا تحتاج إلى توقيع.</p></div><div><small>اليوم</small><b>{dayName(incidentDate)}</b><small>{fmt(incidentDate)}</small></div></div>
      <div className="referral-grid two">
        <label>ابحث عن الطالب<input value={q} onChange={e=>setQ(e.target.value)} placeholder="الاسم أو رقم الطالب"/></label>
        <label>الطالب<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">اختر الطالب</option>{filteredStudents.map(s=><option key={s.id} value={s.id}>{s.name} — {s.grade_name} / فصل {s.class_name}</option>)}</select></label>
        <label>المادة<input required value={subject} onChange={e=>setSubject(e.target.value)} placeholder="مثال: الرياضيات"/></label>
        <label>تاريخ الواقعة<input type="date" required value={incidentDate} onChange={e=>{setIncidentDate(e.target.value);setD1(e.target.value);setD2(e.target.value);setD3(e.target.value)}}/></label>
      </div>
      <div className="digital-choice"><b>جهة التحويل</b><div><button type="button" className={targetRole==="VICE_PRINCIPAL"?"active":""} onClick={()=>setTargetRole("VICE_PRINCIPAL")}>وكيل المدرسة</button><button type="button" className={targetRole==="GUIDANCE_COUNSELOR"?"active":""} onClick={()=>setTargetRole("GUIDANCE_COUNSELOR")}>الموجه الطلابي</button></div></div>
      <div className="referral-grid two compact"><div className="digital-choice"><b>تصنيف المخالفة</b><div><button type="button" className={category==="EDUCATIONAL"?"active":""} onClick={()=>setCategory("EDUCATIONAL")}>تعليمية</button><button type="button" className={category==="BEHAVIORAL"?"active":""} onClick={()=>setCategory("BEHAVIORAL")}>سلوكية</button></div></div><div className="digital-choice"><b>التكرار</b><div><button type="button" className={occurrence==="FIRST"?"active":""} onClick={()=>setOccurrence("FIRST")}>أول مرة</button><button type="button" className={occurrence==="REPEATED"?"active":""} onClick={()=>setOccurrence("REPEATED")}>مكررة</button></div></div></div>
      <label>نوع المخالفة التي قام بها الطالب<textarea rows={3} required value={violation} onChange={e=>setViolation(e.target.value)} placeholder="اكتب وصفًا واضحًا ومحددًا للمخالفة"/></label>
      <label>تفسير المخالفة<textarea rows={3} required value={explanation} onChange={e=>setExplanation(e.target.value)} placeholder="السياق والتفاصيل التي تفسر الواقعة"/></label>
      <div className="teacher-actions"><div className="section-caption"><b>الإجراء المتخذ من قبل المعلم</b><span>الإجراء الأول مطلوب، والثاني والثالث عند الحاجة.</span></div>
        <div className="teacher-action-row"><span>1</span><input required value={a1} onChange={e=>setA1(e.target.value)} placeholder="الإجراء الأول"/><input type="date" required value={d1} onChange={e=>setD1(e.target.value)}/></div>
        <div className="teacher-action-row"><span>2</span><input value={a2} onChange={e=>setA2(e.target.value)} placeholder="الإجراء الثاني — اختياري"/><input type="date" value={d2} onChange={e=>setD2(e.target.value)}/></div>
        <div className="teacher-action-row"><span>3</span><input value={a3} onChange={e=>setA3(e.target.value)} placeholder="الإجراء الثالث — اختياري"/><input type="date" value={d3} onChange={e=>setD3(e.target.value)}/></div>
      </div>
      <div className="digital-signature"><div><small>المعلم المحوِّل</small><b>{profileName}</b></div><span>موثق إلكترونيًا</span></div>
      <button className="btn primary referral-submit" disabled={submitting}>{submitting?"جارٍ إرسال التحويل...":"إرسال التحويل"}</button>
    </form>}

    {tab==="OPEN"&&<section className="referral-list">{loading?<div className="panel empty">جارٍ تحميل التحويلات...</div>:open.length?open.map(r=><ReferralCard key={r.id} r={r} canHandle={canHandle} deductDraft={deductDraft} setDeductDraft={setDeductDraft} noteDraft={noteDraft} setNoteDraft={setNoteDraft} completeDraft={completeDraft} setCompleteDraft={setCompleteDraft} actionBusy={actionBusy} deduct={deduct} complete={complete}/>):<div className="panel empty">لا توجد تحويلات مفتوحة حاليًا.</div>}</section>}

    {tab==="COMPLETED"&&<section className="panel referral-archive"><div className="panel-title"><div><h3>تقرير التحويلات المنتهية</h3><p>أرشيف رقمي للإجراءات التي تم إنهاؤها.</p></div><button className="btn ghost no-print" onClick={()=>window.print()}>طباعة التقرير</button></div>{completed.length?<div className="table-wrap"><table><thead><tr><th>رقم التحويل</th><th>الطالب</th><th>الفصل</th><th>المعلم</th><th>الجهة</th><th>المخالفة</th><th>الخصم</th><th>الإجراء النهائي</th><th>تاريخ الإنهاء</th></tr></thead><tbody>{completed.map(r=><tr key={r.id}><td><b>{r.referral_no}</b></td><td>{r.student_name}<small className="table-sub">{r.student_no}</small></td><td>{r.grade_name} / {r.class_name}</td><td>{r.teacher_name}</td><td>{r.target_label}</td><td>{r.violation_category_label} — {r.occurrence_label}</td><td>{r.deducted_points?`${r.deducted_points} نقطة`:"بدون خصم"}</td><td>{r.completion_note||"تم اللازم"}<small className="table-sub">{r.completed_by_name||"—"}</small></td><td>{fmt(r.completed_at)}</td></tr>)}</tbody></table></div>:<div className="empty">لا توجد تحويلات منتهية حتى الآن.</div>}</section>}
  </main></>;
}

function ReferralCard({r,canHandle,deductDraft,setDeductDraft,noteDraft,setNoteDraft,completeDraft,setCompleteDraft,actionBusy,deduct,complete}:{r:Referral;canHandle:boolean;deductDraft:Record<string,string>;setDeductDraft:any;noteDraft:Record<string,string>;setNoteDraft:any;completeDraft:Record<string,string>;setCompleteDraft:any;actionBusy:string;deduct:(r:Referral)=>void;complete:(r:Referral)=>void}){
  const actions=[[r.teacher_action_1,r.teacher_action_date_1],[r.teacher_action_2,r.teacher_action_date_2],[r.teacher_action_3,r.teacher_action_date_3]].filter(x=>x[0]);
  return <article className="panel referral-card"><div className="referral-card-head"><div><span className="referral-no">{r.referral_no}</span><h3>{r.student_name}</h3><p>{r.grade_name} — فصل {r.class_name} · رقم الطالب {r.student_no}</p></div><div className="referral-badges"><span>{r.target_label}</span><span>{r.violation_category_label}</span><span>{r.occurrence_label}</span></div></div>
    <div className="referral-meta"><div><small>المعلم المحوِّل</small><b>{r.teacher_name}</b></div><div><small>المادة</small><b>{r.subject_ar}</b></div><div><small>تاريخ الواقعة</small><b>{fmt(r.incident_date)}</b></div><div><small>الرصيد الحالي</small><b>{Number(r.wallet_points).toLocaleString("ar-SA")} نقطة</b></div></div>
    <div className="referral-details"><div><small>نوع المخالفة</small><p>{r.violation_text}</p></div><div><small>تفسير المخالفة</small><p>{r.violation_explanation}</p></div></div>
    <div className="referral-teacher-actions"><small>إجراءات المعلم السابقة</small>{actions.map((a,i)=><div key={i}><b>{i+1}</b><span>{a[0]}</span><em>{fmt(a[1])}</em></div>)}</div>
    {r.deducted_points>0&&<div className="deduction-done"><b>تم خصم {r.deducted_points} نقطة</b><span>{r.deduction_note||"خصم نقاط بناء على التحويل"} · {r.deducted_by_name||""} · {fmt(r.deducted_at)}</span></div>}
    {canHandle&&<div className="recipient-actions no-print">
      {r.deducted_points===0&&<div className="deduction-box"><div><b>خصم نقاط من الطالب</b><span>الصلاحية متاحة بسبب هذا التحويل فقط، ولا يمكن الخصم أكثر من مرة لنفس التحويل.</span></div><input type="number" min="1" max={Math.max(1,r.wallet_points)} placeholder="عدد النقاط" value={deductDraft[r.id]||""} onChange={e=>setDeductDraft((v:any)=>({...v,[r.id]:e.target.value}))}/><input placeholder="سبب الخصم — اختياري" value={noteDraft[r.id]||""} onChange={e=>setNoteDraft((v:any)=>({...v,[r.id]:e.target.value}))}/><button className="btn danger" disabled={actionBusy===r.id+"d"||r.wallet_points<=0} onClick={()=>deduct(r)}>{actionBusy===r.id+"d"?"جارٍ الخصم...":"خصم النقاط"}</button></div>}
      <div className="complete-box"><div><b>إنهاء التحويل</b><span>بعد الإنهاء ينتقل التحويل مباشرة إلى تقرير التحويلات المنتهية.</span></div><input placeholder="الإجراء الذي تم — اختياري (الافتراضي: تم اللازم)" value={completeDraft[r.id]||""} onChange={e=>setCompleteDraft((v:any)=>({...v,[r.id]:e.target.value}))}/><button className="btn primary" disabled={actionBusy===r.id+"c"} onClick={()=>complete(r)}>{actionBusy===r.id+"c"?"جارٍ الإنهاء...":"تم الإجراء ونقل للأرشيف"}</button></div>
    </div>}
  </article>;
}

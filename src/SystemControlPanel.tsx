import { FormEvent, useEffect, useState } from "react";
import { niceError, rpc } from "./client";
import "./feature-upgrade.css";

type Rule = { id:string; name_ar:string; description_ar?:string|null; points:number; is_mega:boolean; is_active:boolean };
type AdminClass = { id:string; grade_name:string; class_name:string };
type Announcement = { id:string; title_ar:string; body_ar:string; starts_at:string; ends_at?:string|null; is_published:boolean; created_at:string; announcement_type?:string; criteria?:string[]; target_class_ids?:string[]; target_classes?:AdminClass[] };
type Board = { available:boolean; name_ar?:string; week_no?:number; starts_on?:string; ends_on?:string; status?:string; reward?:string; criteria?:Array<{key:string;label:string;weight:number;max_score:number}>; weeks?:Array<{id:string;week_no:number;name_ar:string;starts_on:string;ends_on:string;status:string}> };

const today=()=>new Date().toISOString().slice(0,10);
const afterDays=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};

export default function SystemControlPanel(){
  const[rules,setRules]=useState<Rule[]>([]);const[draft,setDraft]=useState<Record<string,string>>({});const[ann,setAnn]=useState<Announcement[]>([]);const[board,setBoard]=useState<Board|null>(null);const[classes,setClasses]=useState<AdminClass[]>([]);const[busy,setBusy]=useState("");const[msg,setMsg]=useState("");
  const[title,setTitle]=useState("");const[body,setBody]=useState("");const[endDate,setEndDate]=useState("");
  const[compTitle,setCompTitle]=useState("");const[compBody,setCompBody]=useState("");const[compStart,setCompStart]=useState(today());const[compEnd,setCompEnd]=useState(afterDays(7));const[compCriteria,setCompCriteria]=useState<string[]>([""]);const[selectedClasses,setSelectedClasses]=useState<string[]>([]);
  async function load(){try{const[r,a,b,c]=await Promise.all([rpc<Rule[]>("api_admin_point_rules"),rpc<Announcement[]>("api_admin_announcements"),rpc<Board>("api_khameesna_competition_board"),rpc<AdminClass[]>("api_admin_classes")]);setRules(r);setAnn(a);setBoard(b);setClasses(c);setDraft(Object.fromEntries(r.map(x=>[x.id,String(x.points)])))}catch(e){setMsg(niceError(e))}}
  useEffect(()=>{load()},[]);
  async function saveRule(r:Rule){const p=Number(draft[r.id]);if(!Number.isFinite(p)||p<1||p>100){setMsg("قيمة النقاط يجب أن تكون من 1 إلى 100.");return}setBusy(r.id);setMsg("");try{await rpc("api_admin_set_point_rule",{p_rule_id:r.id,p_points:p});setMsg(`تم تثبيت قيمة «${r.name_ar}» على ${p} نقطة. المعلم لن يستطيع تغييرها.`);await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  async function publish(e:FormEvent){e.preventDefault();setBusy("announcement");setMsg("");try{await rpc("api_admin_publish_announcement",{p_title_ar:title,p_body_ar:body,p_ends_at:endDate?new Date(endDate+"T23:59:59+03:00").toISOString():null});setTitle("");setBody("");setEndDate("");setMsg("تم نشر الإعلان في بوابة الطلاب.");await load()}catch(e){setMsg(niceError(e))}finally{setBusy("")}}
  function toggleClass(id:string){setSelectedClasses(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
  function criterionChange(index:number,value:string){setCompCriteria(v=>v.map((x,i)=>i===index?value:x))}
  function addCriterion(){setCompCriteria(v=>[...v,""])}
  function removeCriterion(index:number){setCompCriteria(v=>v.length===1?v:v.filter((_,i)=>i!==index))}
  async function launchCompetition(e:FormEvent){
    e.preventDefault();setMsg("");
    const criteria=compCriteria.map(x=>x.trim()).filter(Boolean);
    if(!selectedClasses.length){setMsg("اختر فصلًا واحدًا على الأقل لإطلاق المسابقة.");return}
    if(!criteria.length){setMsg("أضف معيارًا واحدًا على الأقل للمسابقة.");return}
    if(!compStart||!compEnd||compEnd<compStart){setMsg("حدد مدة صحيحة للمسابقة.");return}
    setBusy("competition");
    try{
      await rpc("api_admin_launch_competition",{p_title_ar:compTitle,p_body_ar:compBody,p_criteria:criteria,p_class_ids:selectedClasses,p_starts_at:new Date(compStart+"T00:00:00+03:00").toISOString(),p_ends_at:new Date(compEnd+"T23:59:59+03:00").toISOString()});
      setCompTitle("");setCompBody("");setCompStart(today());setCompEnd(afterDays(7));setCompCriteria([""]);setSelectedClasses([]);setMsg("تم إطلاق المسابقة. ستظهر فقط لطلاب الفصول المحددة خلال مدة المسابقة.");await load();
    }catch(e){setMsg(niceError(e))}finally{setBusy("")}
  }
  const d=(v?:string)=>v?new Date(v+(/T/.test(v)?"":"T12:00:00")).toLocaleDateString("ar-SA",{day:"numeric",month:"short"}):"—";
  const targeted=ann.filter(a=>a.announcement_type==="TARGETED_COMPETITION");
  const general=ann.filter(a=>a.announcement_type!=="TARGETED_COMPETITION");
  return <><header className="topbar"><div><h1>إعدادات مدير النظام</h1><p>قيم البطاقات وإطلاق المسابقات — هذه الصفحة متاحة لمدير النظام فقط</p></div></header><main className="content system-control">
    <section className="panel"><div className="panel-title"><div><h3>قيم بطاقات التميز</h3><p>المعلم يختار البطاقة فقط. عدد النقاط هنا هو القيمة النهائية التي تعتمدها قاعدة البيانات.</p></div><span className="counter">{rules.length}</span></div><div className="point-rule-admin">{rules.map(r=><article key={r.id} className={r.is_mega?"mega-rule-admin":""}><div><b>{r.name_ar}</b><small>{r.is_mega?"شيك عملاق — للإدارة والتوجيه فقط":r.description_ar||"بطاقة تميز"}</small></div><label><input type="number" min="1" max="100" value={draft[r.id]??r.points} onChange={e=>setDraft(v=>({...v,[r.id]:e.target.value}))}/><span>نقطة</span></label><button className="btn primary" disabled={busy===r.id} onClick={()=>saveRule(r)}>{busy===r.id?"جارٍ الحفظ...":"حفظ القيمة"}</button></article>)}</div></section>

    <section className="panel competition-launcher"><div className="panel-title"><div><h3>إطلاق مسابقة للفصول</h3><p>حدد المعايير والفصول ومدة المسابقة. لن يراها إلا طلاب الفصول المختارة.</p></div><span className="counter">{selectedClasses.length} فصل</span></div>
      <form onSubmit={launchCompetition} className="competition-launch-form">
        <div className="competition-main-fields"><label>اسم المسابقة<input required value={compTitle} onChange={e=>setCompTitle(e.target.value)} placeholder="مثال: الفصل الأكثر انضباطًا"/></label><label>وصف المسابقة<textarea required rows={3} value={compBody} onChange={e=>setCompBody(e.target.value)} placeholder="اكتب الهدف والجائزة وأي تعليمات مهمة..."/></label><div className="competition-dates"><label>تبدأ من<input type="date" required value={compStart} onChange={e=>setCompStart(e.target.value)}/></label><label>تنتهي في<input type="date" required min={compStart} value={compEnd} onChange={e=>setCompEnd(e.target.value)}/></label></div></div>
        <div className="competition-builder-grid"><div className="criteria-builder"><div className="builder-title"><b>معايير المسابقة</b><button type="button" className="mini-btn" onClick={addCriterion}>+ إضافة معيار</button></div>{compCriteria.map((c,i)=><div className="criterion-row" key={i}><span>{i+1}</span><input required value={c} onChange={e=>criterionChange(i,e.target.value)} placeholder={`المعيار ${i+1} — مثال: الالتزام بالواجبات`}/><button type="button" disabled={compCriteria.length===1} onClick={()=>removeCriterion(i)}>×</button></div>)}</div>
          <div className="class-target-picker"><div className="builder-title"><b>الفصول المستهدفة</b><button type="button" className="mini-btn" onClick={()=>setSelectedClasses(selectedClasses.length===classes.length?[]:classes.map(c=>c.id))}>{selectedClasses.length===classes.length?"إلغاء الكل":"اختيار الكل"}</button></div><div className="target-class-grid">{classes.map(c=><label key={c.id} className={selectedClasses.includes(c.id)?"target-class active":"target-class"}><input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={()=>toggleClass(c.id)}/><span>{c.grade_name}<small>فصل {c.class_name}</small></span></label>)}</div></div></div>
        <div className="competition-launch-note"><span>✓</span><p>بعد الإطلاق ستظهر المسابقة للطلاب المستهدفين كبانر على شكل شيك داخل بوابتهم، وتختفي تلقائيًا بعد نهاية المدة.</p></div>
        <button className="btn primary competition-launch-btn" disabled={busy==="competition"}>{busy==="competition"?"جارٍ إطلاق المسابقة...":"إطلاق المسابقة الآن"}</button>
      </form>
      {targeted.length>0&&<div className="launched-competitions"><h4>المسابقات التي تم إطلاقها</h4>{targeted.map(a=><article key={a.id}><div><b>{a.title_ar}</b><p>{a.body_ar}</p><small>{d(a.starts_at)} — {d(a.ends_at)} · {a.target_classes?.map(c=>`${c.grade_name} / ${c.class_name}`).join("، ")||"—"}</small></div><span>{a.is_published?"منشورة":"موقوفة"}</span></article>)}</div>}
    </section>

    <section className="panel"><div className="panel-title"><div><h3>إصدار «خميسنا غير»</h3><p>سلسلة أسبوعية من الأسبوع الخامس إلى الأسبوع السابع عشر.</p></div><span className="counter">13 أسبوعًا</span></div>{board?.available&&<><div className="kh-system-summary"><div><small>الأسبوع الأقرب</small><b>{board.name_ar}</b><span>{d(board.starts_on)} — {d(board.ends_on)}</span></div><div><small>الجائزة</small><b>{board.reward}</b></div></div><div className="criteria-admin">{board.criteria?.map(c=><div key={c.key}><b>{c.label}</b><span>{c.weight}% · من {c.max_score} درجات</span></div>)}</div><div className="weeks-admin">{board.weeks?.map(w=><span key={w.id} className={w.status.toLowerCase()}>الأسبوع {w.week_no}</span>)}</div></>}</section>

    <section className="panel"><div className="panel-title"><div><h3>إعلانات عامة للطلاب</h3><p>الإعلان العام يظهر لكل الطلاب. استخدم «إطلاق مسابقة» بالأعلى إذا أردت استهداف فصول محددة.</p></div></div><form className="announcement-form" onSubmit={publish}><label>عنوان الإعلان<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: تنبيه أو إعلان عام"/></label><label>نص الإعلان<textarea required rows={4} value={body} onChange={e=>setBody(e.target.value)} placeholder="تفاصيل الإعلان..."/></label><label>نهاية عرض الإعلان — اختياري<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label><button className="btn primary" disabled={busy==="announcement"}>{busy==="announcement"?"جارٍ النشر...":"نشر الإعلان للطلاب"}</button></form><div className="admin-announcements">{general.map(a=><article key={a.id}><div><b>{a.title_ar}</b><p>{a.body_ar}</p></div><span>{a.is_published?"منشور":"غير منشور"}</span></article>)}</div></section>
    {msg&&<div className="notice sticky-note">{msg}</div>}
  </main></>;
}

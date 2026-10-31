import {useEffect,useMemo,useState} from "react";
import {niceError,rpc} from "./client";
import "./competition-judging.css";
type Participant={student_id:string;student_name:string;student_no:string;submission_type?:string|null;status?:string};
type Score={student_id:string;student_name:string;idea_score:number;quality_score:number;creativity_score:number;presentation_score:number;total_score:number;reviewer_note:string;updated_at:string;position:number;judged_by_name:string};
type Metric="idea"|"quality"|"creativity"|"presentation";
const fields:Array<[Metric,string]>=[["idea","الفكرة والمحتوى"],["quality","جودة التنفيذ"],["creativity","الإبداع والابتكار"],["presentation","العرض والتنظيم"]];
const blank=()=>({idea:0,quality:0,creativity:0,presentation:0,note:""});
export default function CompetitionJudging({id,closed,participants,onApproved}:{id:string;closed:boolean;participants:Participant[];onApproved:()=>Promise<void>}){
 const[scores,setScores]=useState<Score[]>([]),[selected,setSelected]=useState(""),[form,setForm]=useState(blank);
 const[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const[reload,setReload]=useState(0);
 useEffect(()=>{let live=true;setError("");rpc<Score[]>("api_admin_competition_judging",{p_competition_id:id})
 .then(x=>{if(live)setScores(Array.isArray(x)?x:[])}).catch(e=>{if(live)setError(niceError(e))});
 return()=>{live=false}},[id,reload]);
 const chosen=participants.find(p=>p.student_id===selected);
 const scoresById=useMemo(()=>new Map(scores.map(s=>[s.student_id,s])),[scores]);
 const eligible=participants.filter(p=>p.submission_type&&p.status!=="EXCLUDED");
 const total=form.idea+form.quality+form.creativity+form.presentation;
 function choose(id:string){setSelected(id);setMessage("");setError("");
 const x=scoresById.get(id);setForm(x?{idea:x.idea_score,quality:x.quality_score,creativity:x.creativity_score,presentation:x.presentation_score,note:x.reviewer_note}:blank())}
 async function save(){if(!chosen||!closed||busy||chosen.status==="WINNER"||chosen.status==="EXCLUDED")return;
 setBusy(true);setError("");setMessage("");try{
 await rpc("api_admin_score_competition",{p_competition_id:id,p_student_id:selected,
 p_idea:form.idea,p_quality:form.quality,p_creativity:form.creativity,p_presentation:form.presentation,p_note:form.note});
 setMessage("تم حفظ تقييم العمل في سجل التحكيم. لم يُعتمد فوز الطالب أو تُضف نقاط تلقائيًا.");
 setReload(x=>x+1);
 }catch(e){setError(niceError(e))}finally{setBusy(false)}}
 async function approve(s:Score){const p=participants.find(x=>x.student_id===s.student_id);
 if(!closed||!p||p.status==="WINNER"||!p.submission_type||!window.confirm("اعتماد "+p.student_name+" فائزًا بدرجة "+s.total_score+"/100؟ سيحصل على 20 نقطة وتظهر التهنئة للطالب وولي الأمر."))return;
 setBusy(true);setError("");setMessage("");
 try{const result=await rpc<{points_awarded:number}>("api_admin_set_competition_participant_status",{p_competition_id:id,p_student_id:p.student_id,p_action:"WINNER"});
 setMessage("تم اعتماد الفوز. النقاط الجديدة: "+Number(result?.points_awarded||0)+".");await onApproved();setReload(x=>x+1)}
 catch(e){setError(niceError(e))}finally{setBusy(false)}}
 return <section className="cj-root" dir="rtl">
 <header className="cj-head"><div><h4>لجنة التحكيم — تقييم المشاركات</h4><p>معايير موحدة: 25 درجة لكل معيار، والمجموع 100 درجة. الاعتماد النهائي يتم يدويًا بعد المراجعة.</p></div>
 <button type="button" className="mini-btn" onClick={()=>setReload(x=>x+1)}>تحديث الدرجات</button></header>
 {!closed&&<p className="cj-notice">أغلق المسابقة أولًا قبل بدء التحكيم حتى لا تتغير المشاركات أثناء التقييم.</p>}
 {error&&<p className="cj-error" role="alert">{error}</p>}{message&&<p className="cj-success" role="status">{message}</p>}
 <div className="cj-grid"><div className="cj-form">
 <label>اختر العمل المُقدَّم<select value={selected} onChange={e=>choose(e.target.value)}>
 <option value="">اختر طالبًا</option>{eligible.map(p=><option key={p.student_id} value={p.student_id}>{p.student_name}{p.status==="WINNER"?" — فائز":""}</option>)}</select></label>
 {selected&&chosen&&<><div className="cj-score-total">التقييم الحالي: <strong>{total} / 100</strong></div>
 {fields.map(([field,label])=><label key={field}>{label} (0–25)<input type="number" min={0} max={25} step={1}
 value={form[field]} disabled={!closed||chosen.status==="WINNER"}
 onChange={e=>setForm(x=>({...x,[field]:Math.max(0,Math.min(25,Math.round(Number(e.target.value)||0)))}))}/></label>)}
 <label>ملاحظة لجنة التحكيم<textarea maxLength={900} value={form.note}
 disabled={!closed||chosen.status==="WINNER"} onChange={e=>setForm(x=>({...x,note:e.target.value}))} rows={2}/></label>
 <button type="button" className="cj-primary" disabled={busy||!closed||chosen.status==="WINNER"}
 onClick={()=>void save()}>{busy?"جارٍ الحفظ…":"حفظ التقييم"}</button></>}
 {!eligible.length&&<p className="cj-notice">لا توجد أعمال مقدمة قابلة للتحكيم.</p>}
 </div>
 <div className="cj-results"><h5>نتائج التحكيم ({scores.length})</h5>
 <div className="cj-table"><table><thead><tr><th>المركز</th><th>الطالب</th><th>الدرجة</th><th>الحالة</th><th>الإجراء</th></tr></thead>
 <tbody>{scores.map(s=>{const p=participants.find(x=>x.student_id===s.student_id);return <tr key={s.student_id}>
 <td>{s.position}</td><td>{s.student_name}</td><td><strong>{s.total_score}/100</strong></td>
 <td>{p?.status==="WINNER"?"فائز معتمد":p?.status==="EXCLUDED"?"مستبعد":"بانتظار الاعتماد"}</td>
 <td><button type="button" className="mini-btn" onClick={()=>choose(s.student_id)}>عرض</button>
 {closed&&p&&p.status!=="WINNER"&&p.status!=="EXCLUDED"&&<button type="button" className="mini-btn winner-btn" disabled={busy} onClick={()=>void approve(s)}>اعتماد فائز</button>}</td>
 </tr>})}</tbody></table></div>
 {!scores.length&&<p>لم تُسجل درجات تحكيم بعد.</p>}
 <small>تساوي الدرجات يُظهر نفس المركز لجميع المتعادلين؛ قرار اعتماد الفائزين مسؤولية الإدارة.</small>
 </div></div></section>;
}

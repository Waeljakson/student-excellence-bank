import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./phase3-support.css";
type Teacher={id:string;teacher_name:string;total_notes:number;positive_notes:number;
 followup_notes:number;students_reached:number;issued_checks:number;points_issued:number;
 submitted_evaluations:number};
type Response={days:number;school_name:string;teachers:Teacher[]};
const num=(v:number)=>Number(v||0).toLocaleString("ar-SA");
export default function Phase3TeacherEngagement({days}:{days:number}){
 const[data,setData]=useState<Response|null>(null),[busy,setBusy]=useState(false);
 const[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setBusy(true);setError("");
 rpc<Response>("api_phase3_teacher_engagement",{p_days:days})
 .then(x=>{if(live)setData(x)}).catch(e=>{if(live)setError(niceError(e))})
 .finally(()=>{if(live)setBusy(false)});
 return()=>{live=false}},[days,refresh]);
 return <section className="p3-card" dir="rtl">
 <div className="p3-head p3-subhead"><div><span>مؤشرات وصفية فقط</span>
 <h2>مشاركة المعلمين في التحفيز والمتابعة</h2>
 <p>تعرض الأنشطة المسجلة خلال الفترة المختارة، ولا تُستخدم لترتيب المعلمين أو تقييم أدائهم؛ تختلف طبيعة المواد والحصص.</p></div>
 <button className="p3-btn light" disabled={busy} type="button" onClick={()=>setRefresh(x=>x+1)}>تحديث</button></div>
 {error&&<p className="p3-error">{error}</p>}
 {busy&&!data&&<p className="p3-empty">جارٍ تحميل مشاركة المعلمين…</p>}
 {data&&<div className="p3-table"><table>
 <thead><tr><th>المعلم</th><th>ملاحظات متابعة</th><th>إيجابية</th><th>ملاحظات تحتاج دعمًا</th>
 <th>طلاب شملتهم المتابعة</th><th>شيكات التميز</th><th>نقاط التميز</th><th>تقييمات مسجلة</th></tr></thead>
 <tbody>{data.teachers.map(t=><tr key={t.id}>
 <td><b>{t.teacher_name}</b></td><td>{num(t.total_notes)}</td><td>{num(t.positive_notes)}</td>
 <td>{num(t.followup_notes)}</td><td>{num(t.students_reached)}</td>
 <td>{num(t.issued_checks)}</td><td>{num(t.points_issued)}</td><td>{num(t.submitted_evaluations)}</td>
 </tr>)}</tbody></table></div>}
 {!busy&&data?.teachers.length===0&&<p className="p3-empty">لا يوجد معلمون مسجلون في المدرسة الحالية.</p>}
 </section>;
}

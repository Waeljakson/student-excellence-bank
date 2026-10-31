import {useEffect,useState} from "react";
import {rpc,niceError} from "./client";
import "./smart-analytics.css";
type Data=Record<string,any>;
const num=(n:any)=>Number(n||0).toLocaleString("ar-SA");
export function SmartDashboard(){
 const [days,setDays]=useState(30),[grade,setGrade]=useState(""),[section,setSection]=useState("");
 const [data,setData]=useState<Data|null>(null),[grades,setGrades]=useState<any[]>([]),[classes,setClasses]=useState<any[]>([]);
 const [error,setError]=useState(""),[loading,setLoading]=useState(true),[tick,setTick]=useState(0);
 const [selected,setSelected]=useState<"WITH_CHECKS"|"WITHOUT_CHECKS"|null>(null),[page,setPage]=useState(0),[detail,setDetail]=useState<Data|null>(null);
 useEffect(()=>{let live=true;setLoading(true);setError("");
 rpc<Data>("api_smart_dashboard",{p_days:days,p_grade_id:grade||null,p_class_id:section||null}).then(r=>{
 if(!live)return;setData(r);if(!grade&&!section){setGrades(r.grades||[]);setClasses(r.classes||[])}})
 .catch(e=>{if(live)setError(niceError(e))}).finally(()=>{if(live)setLoading(false)});
 return()=>{live=false}},[days,grade,section,tick]);
 useEffect(()=>{if(!selected)return;let live=true;setDetail(null);
 rpc<Data>("api_smart_dashboard_students",{p_days:days,p_grade_id:grade||null,p_class_id:section||null,p_mode:selected,p_page:page})
 .then(r=>{if(live)setDetail(r)}).catch(e=>{if(live)setError(niceError(e))});
 return()=>{live=false}},[days,grade,section,selected,page]);
 const metrics:[string,any,string?][]=[["الطلاب",data?.summary?.students],["الطلاب المحفزون",data?.summary?.active_students,"WITH_CHECKS"],
 ["لم يحصلوا على شيكات",data?.summary?.students_without_points,"WITHOUT_CHECKS"],["شيكات الفترة",data?.summary?.checks_issued],
 ["نقاط الفترة",data?.summary?.points_issued],["شيكات اليوم",data?.summary?.checks_today],
 ["المعلمون المشاركون",data?.summary?.teachers_participating],["زيارات أولياء الأمور",data?.summary?.guardian_visits]];
 return <main className="sa-root content" dir="rtl"><header className="sa-header"><div><h1>لوحة القيادة الذكية</h1><p>بيانات المدرسة الحالية مباشرة من بنك التميز.</p></div>
 <button className="sa-btn" onClick={()=>setTick(x=>x+1)}>تحديث الآن</button></header>
 <section className="sa-filters"><label>الفترة<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,60,90].map(x=><option key={x} value={x}>آخر {x} يومًا</option>)}</select></label>
 <label>الصف<select value={grade} onChange={e=>{setGrade(e.target.value);setSection("")}}><option value="">كل الصفوف</option>{grades.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 <label>الفصل<select value={section} onChange={e=>setSection(e.target.value)}><option value="">كل الفصول</option>{classes.filter((x:any)=>!grade||x.grade_id===grade).map((x:any)=><option key={x.id} value={x.id}>{x.grade_name} — {x.name}</option>)}</select></label></section>
 {loading&&<p>جارٍ تحديث البيانات…</p>}{error&&<p role="alert">{error}</p>}
 {data&&<><p>{data.school_name} · {data.filters?.from} إلى {data.filters?.to}</p><div className="sa-metrics">{metrics.map(([label,value,mode])=>mode?
 <button className="sa-metric" type="button" key={label} onClick={()=>{setSelected(mode as "WITH_CHECKS"|"WITHOUT_CHECKS");setPage(0)}}><span>{label}</span><strong>{num(value)}</strong><small>عرض الطلاب</small></button>:
 <article className="sa-metric" key={label}><span>{label}</span><strong>{num(value)}</strong></article>)}</div>
 <section className="sa-panel"><h2>تطور النقاط يوميًا</h2>
 <div className="sa-chart"><svg viewBox="0 0 700 185" role="img" aria-label="تطور نقاط التميز الممنوحة يوميًا">
 <polyline fill="none" stroke="#0a8da6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
 points={(data.trend||[]).map((x:any,i:number,arr:any[])=>{
 const top=Math.max(1,...arr.map((v:any)=>Number(v.points||0)));
 return (20+i*660/Math.max(1,arr.length-1))+","+(165-Number(x.points||0)*140/top);
 }).join(" ")}/>
 </svg><div className="sa-chart-labels"><span>{data.trend?.[0]?.date?.slice(0,10)||""}</span><b>النقاط اليومية خلال الفترة المحددة</b><span>{data.trend?.[data.trend.length-1]?.date?.slice(0,10)||""}</span></div></div></section>
 <section className="sa-panel"><h2>مشاركة الصفوف</h2><div className="sa-bars">{(data.grades||[]).map((x:any)=><div className="sa-bar-item" key={x.id}><div><b>{x.name}</b><span>{num(x.active)} من {num(x.students)}</span></div><div className="sa-track"><i style={{width:(x.students?Math.round(100*x.active/x.students):0)+"%"}}/></div></div>)}</div></section>
 <section className="sa-panel"><h2>الفصول</h2><div className="sa-table-wrap"><table><thead><tr><th>الصف</th><th>الفصل</th><th>الطلاب</th><th>المحفزون</th><th>الشيكات</th><th>النقاط</th></tr></thead><tbody>{(data.classes||[]).map((x:any)=><tr key={x.id}><td>{x.grade_name}</td><td>{x.name}</td><td>{num(x.students)}</td><td>{num(x.active)}</td><td>{num(x.checks)}</td><td>{num(x.points)}</td></tr>)}</tbody></table></div></section>
 <section className="sa-panel"><h2>مشاركة المعلمين</h2><div className="sa-table-wrap"><table><thead><tr><th>المعلم</th><th>الشيكات</th><th>الطلاب</th><th>النقاط</th></tr></thead><tbody>{(data.teachers||[]).map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{num(x.checks)}</td><td>{num(x.students)}</td><td>{num(x.points)}</td></tr>)}</tbody></table></div></section></>}
 {selected&&<div className="sa-modal-overlay"><section className="sa-modal" role="dialog" aria-modal="true"><div className="sa-modal-head"><h2>تفاصيل الطلاب</h2><button className="sa-btn" onClick={()=>setSelected(null)}>إغلاق</button></div><p>عدد الطلاب: {num(detail?.total)}</p><div className="sa-table-wrap"><table><thead><tr><th>الطالب</th><th>الصف</th><th>الفصل</th><th>شيكات</th></tr></thead><tbody>{(detail?.students||[]).map((x:any)=><tr key={x.id}><td>{x.name}</td><td>{x.grade_name}</td><td>{x.class_name}</td><td>{num(x.checks)}</td></tr>)}</tbody></table></div><nav className="sa-pagination"><button disabled={page===0} onClick={()=>setPage(x=>x-1)}>السابق</button><span>{page+1}</span><button disabled={(page+1)*60>=Number(detail?.total||0)} onClick={()=>setPage(x=>x+1)}>التالي</button></nav></section></div>}
 </main>
}

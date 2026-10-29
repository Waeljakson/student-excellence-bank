import {useEffect,useState} from "react";
import {niceError,rpc} from "./client";
import "./period-notices.css";

type Subject={subject:string;maximum:number|null;total:number|null;note?:string;
  assessments?:Record<string,number|null>};
export type PeriodNotice={id:string;title:string;academic_year:string;semester:string;
  period_title:string;grade:string;class_name:string;subjects:Subject[];
  sum_max:number|null;sum_total:number|null;attendance:number|null;
  behavior_excellence:number|null;behavior_positive:number|null;published_at:string};
export type PeriodNoticeChild={id:string;name:string;period_notices?:PeriodNotice[]};
const fmt=(n:number|null|undefined)=>n==null?"—":Number(n).toLocaleString("ar-SA",{maximumFractionDigits:2});

/** Pure child renderer also works with guardian portal data: children[].period_notices */
export function PeriodNoticesInline({children,emptyMessage=true}:{children:PeriodNoticeChild[];emptyMessage?:boolean}){
  const visible=children.filter(x=>(x.period_notices||[]).length);
  if(!visible.length)return emptyMessage?<section className="panel period-inline-empty" dir="rtl">
    <h3>إشعارات نتائج الفترات</h3><p>لا توجد إشعارات منشورة حتى الآن.</p></section>:null;
  return <section className="period-notices period-notice-reader" dir="rtl">
    <h2>إشعارات نتائج الفترات</h2>
    {visible.map(child=><div className="period-child" key={child.id}>
      <h3>إشعارات الطالب: {child.name}</h3>
      {(child.period_notices||[]).map(n=><article key={n.id} className="period-notice panel">
        <div className="period-notice-title"><div><h4>{n.title||"إشعار الفترة"}</h4>
          <p>{n.academic_year} · {n.semester} · {n.period_title} · {n.grade} / فصل {n.class_name}</p></div>
          <span className="period-published">منشور</span></div>
        <div className="table-wrap"><table className="period-table">
          <thead><tr><th>المادة الدراسية</th><th>الدرجة</th><th>النهاية العظمى</th><th>تفاصيل التقييم</th></tr></thead>
          <tbody>{(n.subjects||[]).map((s,i)=><tr key={i}>
            <td><strong>{s.subject}</strong>{s.note&&<small>{s.note}</small>}</td>
            <td><b>{fmt(s.total)}</b></td><td>{fmt(s.maximum)}</td>
            <td><div className="period-components">
              {Object.entries(s.assessments||{}).filter(([,val])=>val!=null).map(([name,val])=><span key={name}>
                {name}: <b>{fmt(val)}</b></span>)}
              {!Object.values(s.assessments||{}).some(x=>x!=null)&&"—"}
            </div></td>
          </tr>)}</tbody>
        </table></div>
        <div className="period-summary">
          <span>المجموع: <b>{fmt(n.sum_total)} / {fmt(n.sum_max)}</b></span>
          <span>المواظبة: <b>{fmt(n.attendance)}</b></span>
          <span>السلوك الإيجابي: <b>{fmt(n.behavior_positive)}</b></span>
          <span>السلوك المتميز: <b>{fmt(n.behavior_excellence)}</b></span>
        </div>
      </article>)}
    </div>)}
  </section>;
}

/** Separate authenticated panel for students and guardians. No IDs passed by user. */
export default function PeriodNoticeViewer(){
  const[children,setChildren]=useState<PeriodNoticeChild[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  async function load(){
    setLoading(true);
    try{
      const d=await rpc<{role:string;children:PeriodNoticeChild[]}>("api_period_notice_my");
      setChildren(Array.isArray(d?.children)?d.children:[]);setError("");
    }catch(e){setError(niceError(e))}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);
  return <div className="period-notices" dir="rtl">
    {error&&<div className="notice error" role="alert">{error}</div>}
    <button type="button" className="mini-btn" onClick={()=>void load()} disabled={loading}>
      {loading?"جارٍ تحميل إشعارات النتائج...":"تحديث الإشعارات"}
    </button>
    {!loading&&<PeriodNoticesInline children={children}/>}
    {loading&&<p>جارٍ تحميل الإشعارات المنشورة...</p>}
  </div>;
}